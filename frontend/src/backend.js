export const backend = {
    async call(method, ...args) {
        return window['go']['main']['App'][method](...args);
    }
};
