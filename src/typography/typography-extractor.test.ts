const { extractTypography } = require('./typography-extractor');

test('extracts correct typography styles', () => {
	const input = '<h1 style="font-size: 20px;">Hello World</h1>';
	const expectedOutput = { fontSize: '20px' };
	expect(extractTypography(input)).toEqual(expectedOutput);
});

test('returns empty object for unsupported tags', () => {
	const input = '<div>Unsupported Tag</div>';
	const expectedOutput = {};
	expect(extractTypography(input)).toEqual(expectedOutput);
});