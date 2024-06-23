/// a92b03de42~1:sui/sdk/typescript/src/transactions/serializer.ts

import { SuiMoveNormalizedType } from "@mysten/sui/client";
import { CallArg } from "@mysten/sui/transactions";
import {
	MOVE_STDLIB_ADDRESS,
	SUI_FRAMEWORK_ADDRESS,
	isValidSuiAddress,
	normalizeSuiAddress,
} from "@mysten/sui/utils";

// === Constants ===

const ALLOWED_TYPES = ["Address", "Bool", "U8", "U16", "U32", "U64", "U128", "U256"];

const OBJECT_MODULE_NAME = "object";
const ID_STRUCT_NAME = "ID";

const STD_ASCII_MODULE_NAME = "ascii";
const STD_ASCII_STRUCT_NAME = "String";

const STD_UTF8_MODULE_NAME = "string";
const STD_UTF8_STRUCT_NAME = "String";

const STD_OPTION_MODULE_NAME = "option";
const STD_OPTION_STRUCT_NAME = "Option";

const RESOLVED_SUI_ID = {
	address: SUI_FRAMEWORK_ADDRESS,
	module: OBJECT_MODULE_NAME,
	name: ID_STRUCT_NAME,
};
const RESOLVED_ASCII_STR = {
	address: MOVE_STDLIB_ADDRESS,
	module: STD_ASCII_MODULE_NAME,
	name: STD_ASCII_STRUCT_NAME,
};
const RESOLVED_UTF8_STR = {
	address: MOVE_STDLIB_ADDRESS,
	module: STD_UTF8_MODULE_NAME,
	name: STD_UTF8_STRUCT_NAME,
};

const RESOLVED_STD_OPTION = {
	address: MOVE_STDLIB_ADDRESS,
	module: STD_OPTION_MODULE_NAME,
	name: STD_OPTION_STRUCT_NAME,
};

// === Helpers ===

function isSameStruct(a: any, b: any) {
	return a.address === b.address
		&& a.module === b.module
		&& a.name === b.name;
}

function expectType(typeName: string, argVal?: SuiJsonValue) {
	if (typeof argVal === "undefined") {
		return;
	}
	if (typeof argVal !== typeName) {
		throw new Error(`Expected ${String(argVal)} to be ${typeName}, received ${typeof argVal}`);
	}
}

export function getPureSerializationTypeAndValue( // TODO: vector, option
	normalizedType: SuiMoveNormalizedType,
	argVal: SuiJsonValue | undefined,
): { type: string | undefined; value: SuiJsonValue | undefined  }
{
	if (typeof normalizedType === "string" && ALLOWED_TYPES.includes(normalizedType))
	{
		if (normalizedType in ["U8", "U16", "U32", "U64", "U128", "U256"])
		{
			expectType("number", argVal);
		}
		else if (normalizedType === "Bool")
		{
			expectType("string", argVal);

			const argStr = (argVal as string).toLowerCase();
			if ( !["0", "1", "false", "true"].includes(argStr) ) {
				throw new Error("Invalid Bool");
			}

			const boolValue = argStr === "1" || argStr === "true";
			return { type: normalizedType.toLowerCase(), value: boolValue };
		}
		else if (normalizedType === "Address")
		{
			expectType("string", argVal);

			const normalizedAddr = normalizeSuiAddress(argVal as string);
			if (argVal && !isValidSuiAddress(normalizedAddr)) {
				throw new Error("Invalid Sui Address");
			}

			return { type: normalizedType.toLowerCase(), value: normalizedAddr };
		}

		return { type: normalizedType.toLowerCase(), value: argVal };
	}
	else if (typeof normalizedType === "string") {
		throw new Error(`Unknown pure normalized type ${JSON.stringify(normalizedType, null, 2)}`);
	}

	if ("Vector" in normalizedType)
	{
		if ((argVal === undefined || typeof argVal === "string") && normalizedType.Vector === "U8") {
			return { type: "string", value: argVal };
		}

		if (argVal !== undefined && !Array.isArray(argVal)) {
			throw new Error(`Expect ${String(argVal)} to be a array, received ${typeof argVal}`);
		}

		const { type: innerType } = getPureSerializationTypeAndValue(
			normalizedType.Vector,
			// undefined when argVal is empty
			argVal ? argVal[0] : undefined,
		);

		if (innerType === undefined) {
			return { type: undefined, value: argVal };
		}

		return { type: `vector<${innerType}>`, value: argVal };
	}

	if ("Struct" in normalizedType)
	{
		if (isSameStruct(normalizedType.Struct, RESOLVED_ASCII_STR)) {
			return { type: "string", value: argVal };
		}
		else if (isSameStruct(normalizedType.Struct, RESOLVED_UTF8_STR)) {
			return { type: "string", value: argVal };
		}
		else if (isSameStruct(normalizedType.Struct, RESOLVED_SUI_ID)) {
			return { type: "address", value: argVal };
		}
		else if (isSameStruct(normalizedType.Struct, RESOLVED_STD_OPTION)) {
			const optionToVec: SuiMoveNormalizedType = {
				Vector: normalizedType.Struct.typeArguments[0],
			};
			return getPureSerializationTypeAndValue(optionToVec, argVal);
		}
	}

	return { type: undefined, value: argVal };
}

/// a92b03de42~1:sui/sdk/typescript/src/client/types/common.ts

export type SuiJsonValue = boolean | number | string | CallArg | SuiJsonValue[];
