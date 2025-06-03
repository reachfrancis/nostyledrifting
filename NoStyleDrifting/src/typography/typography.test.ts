const { render } = require('@testing-library/react');
const Typography = require('./Typography');

test('renders Typography component with correct text', () => {
    const { getByText } = render(<Typography text="Hello World" />);
    expect(getByText("Hello World")).toBeInTheDocument();
});