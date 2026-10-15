/**
 * An error whose message is safe to return to the client.
 * Anything else is logged server-side and replaced with a generic message.
 */
export class AppError extends Error {}
