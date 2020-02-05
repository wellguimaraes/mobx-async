import { observable, runInAction } from 'mobx'
import { fromPromise } from 'mobx-utils'

interface TrackedAction {
  trackedAction: boolean
  pending: boolean
  error?: Error
  response?: any
  success: boolean
  reset: () => void
}

type AsyncItem = Promise<any> | TrackedAction

export const isPending = (v: AsyncItem): boolean => {
  if ((v as TrackedAction)?.trackedAction) return (v as TrackedAction).pending

  return fromPromise(Promise.resolve(v)).case({
    fulfilled: () => false,
    pending: () => true,
    rejected: () => false,
  })
}

export const getError = (v: AsyncItem): Error | undefined => {
  if ((v as TrackedAction)?.trackedAction) return (v as TrackedAction)?.error

  return fromPromise(Promise.resolve(v)).case({
    fulfilled: () => undefined,
    pending: () => undefined,
    rejected: (err: Error) => err,
  })
}

export const succeeded = (action: TrackedAction) => action && action.success

export const getValue = <T>(v: Promise<T>, defaultValue?: T) =>
  fromPromise(Promise.resolve(v)).case({
    fulfilled: (v: any) => v,
    pending: () => defaultValue,
    rejected: () => defaultValue,
  })

export const dependsOn = (..._: any[]) => {}

export const resetter = (action: TrackedAction) => {
  if (action?.trackedAction) return action.reset

  return () => {}
}


export function trackedAction<T extends (...args: any[]) => void>(fn: T): T & TrackedAction {
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
      (response: any) => {
        fnState.pending = false
        fnState.success = true
        fnState.error = undefined
        fnState.response = response
      },
      err => {
        fnState.response = undefined
        fnState.pending = false
        fnState.error = err
      }
    )
  }

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

  actionWrapper.trackedAction = true
  actionWrapper.reset = () => {
    fnState.pending = false
    fnState.success = false
    fnState.error = undefined
    fnState.response = undefined
  }

  return actionWrapper
}
