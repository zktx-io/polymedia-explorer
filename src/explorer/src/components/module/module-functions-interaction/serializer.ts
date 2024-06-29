import { SuiMoveNormalizedType } from "@mysten/sui/client";
import { CallArg } from "@mysten/sui/transactions";
import {
    MOVE_STDLIB_ADDRESS,
    SUI_FRAMEWORK_ADDRESS,
    isValidSuiAddress,
    normalizeSuiAddress,
} from "@mysten/sui/utils";

export function getSerializationTypesAndValue(
    normalizedType: SuiMoveNormalizedType,
    argVal: SuiJsonValue | undefined,
    typeArguments: string[],
): SerializationTypesAndValue
{
    console.debug("argVal:", argVal, "normalizedType:", JSON.stringify(normalizedType, null, 2));

    if (isPrimitiveType(normalizedType))
    {
        if (["U8", "U16", "U32", "U64", "U128", "U256"].includes(normalizedType))
        {
            if (
                ( !["string", "number", "undefined"].includes(typeof argVal) ) ||
                ( typeof argVal === "string" && !/^\d+$/.test(argVal.trim()) ) ||
                ( typeof argVal === "number" && (!Number.isInteger(argVal) || argVal < 0) )
            ) {
                throw new Error(`Invalid unsigned integer: ${JSON.stringify(argVal)}`);
            }
            return {
                types: [normalizedType],
                value: typeof argVal === "string" ? argVal.trim() : argVal,
             };
        }

        if (normalizedType === "Bool")
        {
            const argStr: string | undefined
                = argVal === undefined ? undefined : String(argVal).trim().toLowerCase();
            if (
                ( !["string", "number", "boolean", "undefined"].includes(typeof argVal) ) ||
                ( argVal !== undefined && !["true", "false", "1", "0"].includes(argStr!) )
            ) {
                throw new Error(`Invalid boolean: ${JSON.stringify(argVal)}`);
            }
            return {
                types: [normalizedType],
                value: argVal === undefined
                    ? undefined
                    : ["true", "1"].includes(argStr!)
                };
        }

        if (normalizedType === "Address") {
            const argAddr: string | undefined =
                argVal === undefined ? undefined : normalizeSuiAddress(String(argVal).trim());
            if (
                ( !["string", "undefined"].includes(typeof argVal) ) ||
                ( argVal !== undefined && !isValidSuiAddress(argAddr!) )
            ) {
                throw new Error(`Invalid Sui address: ${JSON.stringify(argVal)}`);
            }
            return {
                types: [normalizedType],
                value: argAddr,
            };
        }

        throw new Error(`Unsupported primitive type: ${JSON.stringify(normalizedType, null, 2)}`);
    }
    else if (typeof normalizedType === "string") {
        throw new Error(`Unsupported normalized type: ${JSON.stringify(normalizedType, null, 2)}`);
    }

    if ("TypeParameter" in normalizedType)
    {
        const typeArg = typeArguments[normalizedType.TypeParameter].trim();
        const typeArgType = parseTypeArgument(typeArg);
        return getSerializationTypesAndValue(
            typeArgType,
            argVal,
            typeArguments,
        );
    }

    if ("Struct" in normalizedType)
    {
        if (isSameStruct(normalizedType.Struct, RESOLVED_ASCII_STR) ||
            isSameStruct(normalizedType.Struct, RESOLVED_UTF8_STR)
        ) {
            return { types: ["String"], value: argVal };
        }
        else if (isSameStruct(normalizedType.Struct, RESOLVED_SUI_ID)) {
            return { types: ["Address"], value: argVal };
        }
        else if (isSameStruct(normalizedType.Struct, RESOLVED_STD_OPTION)) {
            const { types: innerTypes, value: innerValue } = getSerializationTypesAndValue(
                normalizedType.Struct.typeArguments[0],
                argVal,
                typeArguments,
            );

            return {
                types: [ "option", ...innerTypes.flat() ],
                value: innerValue,
            };
        }
    }

    if ("Vector" in normalizedType)
    {
        // Some vector<u8> args should be serialized with bcs.String
        const serializeAsString =
            typeof argVal === "string"
            && normalizedType.Vector === "U8"
            && !argVal.trim().startsWith("["); // skip actual vector<u8>
        if (serializeAsString) {
            return { types: ["String"], value: argVal };
        }

        // Actual vector args come in the form of a JSON string that needs to be parsed
        if (typeof argVal === "string") {
            try {
                argVal = JSON.parse(argVal);
            } catch (err) {
                throw new Error(`Malformed array: ${String(argVal)}`);
            }
        }

        if (!Array.isArray(argVal) && typeof argVal !== "undefined") {
            throw new Error(`Expect ${String(argVal)} to be a array, received ${typeof argVal}`);
        }

        // Infer the type of the vector from its first element
        const { types: innerTypes } = getSerializationTypesAndValue(
            normalizedType.Vector,
            // undefined when argVal is empty
            argVal ? argVal[0] : undefined,
            typeArguments,
        );

        if (typeof innerTypes === "undefined") {
            return {
                types: [ "vector", undefined, ],
                value: argVal,
            };
        }

        // Transform the vector elements into actual booleans, normalized addresses, etc
        if (Array.isArray(argVal)) {
            const serializedValues: SuiJsonValue[] = [];
            for (const val of argVal) {
                const { value } = getSerializationTypesAndValue(
                    normalizedType.Vector,
                    val,
                    typeArguments,
                );
                serializedValues.push(value!);
            }
            argVal = serializedValues;
        }

        return {
            types: [ "vector", ...innerTypes.flat() ],
            value: argVal,
        };
    }

    return { types: [undefined], value: argVal };
}

// === Types ===

const PRIMITIVE_TYPES = [ "Address", "Bool", "U8", "U16", "U32", "U64", "U128", "U256" ] as const;

type PrimitiveType = typeof PRIMITIVE_TYPES[number];

function isPrimitiveType(type: unknown): type is PrimitiveType {
    return typeof type === "string" && PRIMITIVE_TYPES.includes(type as PrimitiveType);
}

export type SerializationType = PrimitiveType | "String" | "vector" | "option";

type SerializationTypesAndValue = {
    types: (SerializationType|undefined)[];
    value: SuiJsonValue | undefined;
};

type SuiJsonValue = boolean | number | string | CallArg | SuiJsonValue[];

type Struct = {
    address: string;
    module: string;
    name: string;
}

// === Constants ===

const OBJECT_MODULE_NAME = "object";
const ID_STRUCT_NAME = "ID";

const STD_ASCII_MODULE_NAME = "ascii";
const STD_ASCII_STRUCT_NAME = "String";

const STD_UTF8_MODULE_NAME = "string";
const STD_UTF8_STRUCT_NAME = "String";

const STD_OPTION_MODULE_NAME = "option";
const STD_OPTION_STRUCT_NAME = "Option";

const RESOLVED_SUI_ID: Struct = {
    address: SUI_FRAMEWORK_ADDRESS,
    module: OBJECT_MODULE_NAME,
    name: ID_STRUCT_NAME,
};
const RESOLVED_ASCII_STR: Struct = {
    address: MOVE_STDLIB_ADDRESS,
    module: STD_ASCII_MODULE_NAME,
    name: STD_ASCII_STRUCT_NAME,
};
const RESOLVED_UTF8_STR: Struct = {
    address: MOVE_STDLIB_ADDRESS,
    module: STD_UTF8_MODULE_NAME,
    name: STD_UTF8_STRUCT_NAME,
};

const RESOLVED_STD_OPTION: Struct = {
    address: MOVE_STDLIB_ADDRESS,
    module: STD_OPTION_MODULE_NAME,
    name: STD_OPTION_STRUCT_NAME,
};

// === Helpers ===

function isSameStruct(a: Struct, b: Struct) {
    return a.address === b.address
        && a.module === b.module
        && a.name === b.name;
}

function parseTypeArgument(input: string): SuiMoveNormalizedType {
    input = input.trim();

    // Handle vector type
    const isVector = input.startsWith("vector<") && input.endsWith(">");
    if (isVector) {
        const innerType = input.slice(7, -1).trim();
        return { Vector: parseTypeArgument(innerType) };
    }

    // Handle primitive types
    const capitalizedInput = input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
    if (isPrimitiveType(capitalizedInput)) {
        return capitalizedInput;
    }

    // Handle struct types
    const structMatch = input.match(/^(0x[a-fA-F0-9]+)::([a-zA-Z0-9_]+)::([a-zA-Z0-9_]+)(<(.+)>)?$/);
    if (structMatch) {
        const [, address, module, name, , typeArgsStr] = structMatch;
        const typeArguments = typeArgsStr ? parseTypeArguments(typeArgsStr) : [];
        return {
            Struct: {
                address,
                module,
                name,
                typeArguments,
            }
        };
    }

    const errMsg = `Unsupported type argument: ${input}`;
    console.warn(errMsg);
    throw new Error(errMsg);
}

function parseTypeArguments(input: string): SuiMoveNormalizedType[] {
    const typeArguments: SuiMoveNormalizedType[] = [];
    let depth = 0;
    let currentArg = "";

    for (const char of input) {
        if (char === "<") depth++;
        if (char === ">") depth--;
        if (char === "," && depth === 0) {
            typeArguments.push(parseTypeArgument(currentArg.trim()));
            currentArg = "";
        } else {
            currentArg += char;
        }
    }

    if (currentArg.trim()) {
        typeArguments.push(parseTypeArgument(currentArg.trim()));
    }

    return typeArguments;
}
