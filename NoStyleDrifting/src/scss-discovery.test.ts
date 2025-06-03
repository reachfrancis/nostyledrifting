const { discoverScss } = require('../scss-discovery');

test('scss discovery should return expected results', () => {
	const result = discoverScss('path/to/scss/files');
	expect(result).toEqual(['expectedResult1', 'expectedResult2']);
});