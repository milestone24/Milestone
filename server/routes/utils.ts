import { Handler, RequestHandler, Request } from "express";

/**
 * @deprecated
 * This should not be needed as we are now using Express version 5 and the async/await syntax is supported.
 */
export const asyncCatch = <T extends any[] = Parameters<RequestHandler>>(
  fn: (...args: T) => any
): ((...args: T) => void) =>
  function asyncUtilWrap(...args: T) {
    const fnReturn = fn(...args);
    const next = args[args.length - 1] as (err?: any) => void;
    return Promise.resolve(fnReturn).catch(next);
  };

export const safeUserHandler = <T extends any[] = Parameters<RequestHandler>>(
  fn: (...args: T) => any
): ((...args: T) => void) =>
  function safeUserHandlerWrap(...args: T) {
    const next = args[args.length - 1] as (err?: any) => void;
    const req = args[0] as Request;
    const aid = req.tenant?.userAccountId;
    if (!aid) {
      return next(new Error("User account ID not found on request"));
    }
    return Promise.resolve(asyncCatch(fn(...args))).catch(next);
  };

export default asyncCatch;
