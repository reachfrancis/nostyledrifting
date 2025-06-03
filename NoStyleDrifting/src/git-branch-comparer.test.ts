const { compareBranches } = require('./git-branch-comparer');

test('compareBranches should return true for identical branches', () => {
    expect(compareBranches('main', 'main')).toBe(true);
});

test('compareBranches should return false for different branches', () => {
    expect(compareBranches('main', 'develop')).toBe(false);
});

test('compareBranches should handle non-existent branches', () => {
    expect(compareBranches('main', 'non-existent')).toBe(false);
});