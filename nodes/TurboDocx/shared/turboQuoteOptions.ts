import { IDataObject, IExecuteFunctions, INodeProperties, NodeOperationError } from 'n8n-workflow';
import { detectBinaryType } from './GenericFunctions';

/**
 * Pieces shared by the TurboQuote resources: list sorting, named duplicates and image uploads.
 */

interface IOption {
	name: string;
	value: string;
}

/** Split a comma-separated string into trimmed, non-empty tokens. */
export function splitCsv(value: string): string[] {
	return value
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

/**
 * The "Sort" collection for a list operation. Left empty, nothing is sent and the API keeps the
 * list's original order.
 */
export function sortCollection(
	resource: string[],
	operation: string[],
	sortByOptions: IOption[],
	defaultOrder: string,
): INodeProperties {
	const sortBy: INodeProperties = {
		displayName: 'Sort By',
		name: 'sortBy',
		type: 'options',
		options: sortByOptions,
		default: '',
		description: 'The column to sort by',
	};
	// The first column is the default (a literal default is required by the node lint)
	sortBy.default = sortByOptions[0].value;

	return {
		displayName: 'Sort',
		name: 'sort',
		type: 'collection',
		placeholder: 'Add Sort Option',
		default: {},
		description: `How to order the results. Without a sort the list is ${defaultOrder}.`,
		displayOptions: {
			show: { resource, operation },
		},
		options: [
			sortBy,
			{
				displayName: 'Sort Direction',
				name: 'sortDirection',
				type: 'options',
				options: [
					{ name: 'Ascending', value: 'asc' },
					{ name: 'Descending', value: 'desc' },
				],
				default: 'asc',
				description: 'Whether to sort A to Z / lowest first (ascending) or the reverse',
			},
		],
	};
}

/** Copy the chosen sort onto the query string. */
export function applySort(ctx: IExecuteFunctions, i: number, qs: IDataObject): void {
	const sort = ctx.getNodeParameter('sort', i, {}) as IDataObject;
	if (sort.sortBy) qs.sortBy = sort.sortBy;
	if (sort.sortDirection) qs.sortDirection = sort.sortDirection;
}

/** The "Additional Fields" collection of a Duplicate operation: an optional name for the copy. */
export function duplicateFieldsCollection(resource: string[]): INodeProperties {
	return {
		displayName: 'Additional Fields',
		name: 'duplicateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource, operation: ['duplicate'] },
		},
		options: [
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Name of the copy. Left empty, the copy is called "Copy of …".',
			},
		],
	};
}

/** The body of a Duplicate request: the copy's name when one is set, else none. */
export function duplicateBody(ctx: IExecuteFunctions, i: number): IDataObject | undefined {
	const fields = ctx.getNodeParameter('duplicateFields', i, {}) as IDataObject;
	return fields.name ? { name: fields.name } : undefined;
}

/** One value and several values for the same query param, merged (a list when several). */
export function oneOrMany(one: unknown, many: unknown): string | string[] | undefined {
	const values: string[] = [];
	if (typeof one === 'string' && one) values.push(one);
	if (Array.isArray(many)) values.push(...(many as string[]));
	if (values.length === 0) return undefined;
	return values.length === 1 ? values[0] : values;
}

/** Products and custom line items each take at most this many images. */
export const MAX_IMAGES = 3;

/** A single file part for an n8n multipart upload. */
export interface IFilePart {
	value: Buffer;
	options: { filename: string; contentType: string };
}

/**
 * Read the named binary properties off the current input item and turn each into an n8n
 * multipart file part, with type detected from the file's magic bytes.
 */
export async function collectImageParts(
	ctx: IExecuteFunctions,
	i: number,
	binaryPropertyNames: string[],
	owner: string,
): Promise<IFilePart[]> {
	// Fail here with a message that names the limit, rather than letting the backend's
	// multer reject the upload with an opaque error.
	if (binaryPropertyNames.length > MAX_IMAGES) {
		throw new NodeOperationError(
			ctx.getNode(),
			`Too many images: ${binaryPropertyNames.length} binary properties given, but a ${owner} takes at most ${MAX_IMAGES}`,
			{ itemIndex: i },
		);
	}

	const parts: IFilePart[] = [];
	for (const propName of binaryPropertyNames) {
		const binaryMeta = ctx.helpers.assertBinaryData(i, propName);
		const buffer = await ctx.helpers.getBinaryDataBuffer(i, propName);
		const detected = detectBinaryType(buffer);
		parts.push({
			value: buffer,
			options: {
				filename: binaryMeta.fileName || `image.${detected.extension}`,
				contentType: binaryMeta.mimeType || detected.mimeType,
			},
		});
	}
	return parts;
}
