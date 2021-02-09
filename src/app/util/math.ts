export const getAverage = (array: number[]) => {
    const sum = array.reduce((a, b) => a + b, 0);
    return sum / array.length || 0;
};

// rounds to two digits
export const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);
