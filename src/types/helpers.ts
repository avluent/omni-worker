/**
 * Applies an interface with static function definitions
 * @returns The constructor of class T
 */
export function staticImplements<T>() {
    return <U extends T>(constructor: U) => { constructor; };
}