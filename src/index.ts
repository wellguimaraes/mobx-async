import { fromPromise } from 'mobx-utils'
import { action, observable, runInAction } from 'mobx'

type AsyncItem = Promise<any> | (any & { trackedAction: boolean; pending: boolean })

export const isPending = (v: AsyncItem): boolean => {
  if (v && v.trackedAction) return v.pending

  return fromPromise(Promise.resolve(v)).case({
    fulfilled: () => false,
    pending: () => true,
    rejected: () => false,
  })
}

export const getError = (v: AsyncItem): Error | undefined => {
  if (v && v.trackedAction) return v.error

  return fromPromise(Promise.resolve(v)).case({
    fulfilled: () => undefined,
    pending: () => undefined,
    rejected: (err: Error) => err,
  })
}

export const succeeded = (action: AsyncItem) => action && action.success

export const getValue = <T>(v: Promise<T>, defaultValue?: T) =>
  fromPromise(Promise.resolve(v)).case({
    fulfilled: (v: any) => v,
    pending: () => defaultValue,
    rejected: () => defaultValue,
  })

export const dependsOn = (..._: any[]) => {}

export const resetter = (action: AsyncItem) => {
  if (action && action.trackedAction) return action.reset

  return () => {}
}

export function trackedAction(fn: () => any) {
  const fnState = observable.object({
    pending: false,
    success: false,
    error: undefined,
    response: undefined,
  })

  const actionWrapper: any = function(...args: any[]) {
    fnState.pending = true
    fnState.success = false
    fnState.error = undefined
    fnState.response = undefined

    return new Promise((resolve, reject) => {
      runInAction(() => {
        try {
          resolve(fn.apply(undefined, args as any))
        } catch (err) {
          reject(err)
        }
      })
    }).then(
      response => {
        fnState.pending = false
        fnState.success = true
        fnState.error = undefined
        // @ts-ignore
        fnState.response = response
      },
      err => {
        fnState.response = undefined
        fnState.pending = false
        fnState.error = err
      }
    )
  }

  Object.defineProperty(actionWrapper, 'trackedAction', {
    get: () => true,
  })

  Object.defineProperty(actionWrapper, 'pending', {
    get: () => fnState.pending,
  })

  Object.defineProperty(actionWrapper, 'error', {
    get: () => fnState.error,
  })

  Object.defineProperty(actionWrapper, 'response', {
    get: () => fnState.response,
  })

  Object.defineProperty(actionWrapper, 'success', {
    get: () => fnState.success,
  })

  actionWrapper.reset = () => {
    fnState.pending = false
    fnState.success = false
    fnState.error = undefined
    fnState.response = undefined
  }

  return actionWrapper
}
