import {
  IComputedValue,
  IObservable,
  IObservableArray,
  IObservableValue,
  observable,
  ObservableMap,
  ObservableSet,
  runInAction
} from 'mobx'
import { fromPromise } from 'mobx-utils'
import { IIsObservableObject } from 'mobx/dist/internal'
import { useEffect, useState } from 'react'
import { AsyncItem, IFunction, IGettable, TrackedAction } from './__types'

const validateTrackedAction = (v: any) => {
  if (typeof v === 'function' && !v.hasOwnProperty('trackedAction')) {
    throw new Error(`${v.name} is not a tracked action`)
  }
}

const toPromise = <T>(
  v:
    | IObservable
    | IComputedValue<Promise<T>>
    | IObservableValue<Promise<T>>
    | IIsObservableObject
    | IObservableArray
    | ObservableMap
    | ObservableSet
    | Promise<T>
) =>
  v instanceof Promise
    ? Promise.resolve(v)
    : v && typeof (v as any).get === 'function'
    ? Promise.resolve((v as any).get())
    : Promise.resolve()

const isPending = (v: AsyncItem): boolean => {
  validateTrackedAction(v)

  if ((v as TrackedAction)?.trackedAction) {
    return (v as TrackedAction).pending
  }

  const value = toPromise(v as IGettable)

  return fromPromise(value).case({
    fulfilled: () => false,
    pending: () => true,
    rejected: () => false
  })
}

const getError = (v: AsyncItem): Error | undefined => {
  validateTrackedAction(v)

  if ((v as TrackedAction)?.trackedAction) {
    return (v as TrackedAction)?.error
  }

  const value = toPromise(v as IGettable)

  return fromPromise(value).case({
    fulfilled: () => undefined,
    pending: () => undefined,
    rejected: (err: Error) => err
  })
}

const succeeded = (action: TrackedAction | IFunction) => {
  validateTrackedAction(action)

  return (action as TrackedAction)?.success
}

const getValue = <T>(value: IGettable<Promise<T>> | Promise<T>, defaultValue?: T): T | undefined => {
  const pValue = toPromise(value)

  return fromPromise(pValue).case({
    fulfilled: (v: any) => v,
    pending: () => defaultValue,
    rejected: () => defaultValue
  })
}

const resetter = (action: TrackedAction | IFunction): (() => void) => {
  validateTrackedAction(action)

  return (action as TrackedAction)?.reset || (() => {})
}

const dependsOn = (...dependencies: AsyncItem[]) => {
  void dependencies.map((it: any) => {
    if (it?.constructor?.name === 'ObservableValue') return it?.get?.()
    if (it?.constructor?.name === 'ComputedValue') return it?.get?.()
    if (it?.trackedAction) return void it?.successVersion?.get()
    return undefined
  })
}

function trackedAction<T extends TrackedAction>(actionBody: T): T
function trackedAction(
  target: Object,
  _?: string | symbol,
  baseDescriptor?: PropertyDescriptor
): void
function trackedAction(
  target: Object,
  _?: string | symbol,
  baseDescriptor?: PropertyDescriptor
): void {
  let fn = baseDescriptor ? baseDescriptor.value : target

  const fnState = observable.object({
    pending: false,
    success: false,
    error: undefined,
    response: undefined
  })

  const successVersion = observable.box(0)

  const actionWrapper: any = function (this: any, ...args: any[]) {
    runInAction(() => {
      fnState.pending = true
      fnState.success = false
      fnState.error = undefined
      fnState.response = undefined
    })

    return new Promise((resolve, reject) => {
      runInAction(() => {
        try {
          resolve(fn.apply(this, args as any))
        } catch (err) {
          reject(err)
        }
      })
    }).then(
      (response: any) => {
        runInAction(() => {
          successVersion.set(successVersion.get() + 1)
          fnState.pending = false
          fnState.success = true
          fnState.error = undefined
          fnState.response = response
        })

        return Promise.resolve(response)
      },
      (err) => {
        runInAction(() => {
          fnState.response = undefined
          fnState.pending = false
          fnState.error = err
        })

        const isLocalHost = /^localhost(:\d+)?/.test(globalThis?.location?.host ?? '')

        if (isLocalHost) {
          console.error(`Mobx async got an error:`, err)
          return Promise.resolve(null)
        } else {
          return Promise.reject(err)
        }
      }
    )
  }

  Object.defineProperty(actionWrapper, 'successVersion', {
    enumerable: false,
    value: successVersion
  })

  Object.defineProperty(actionWrapper, 'pending', {
    get: () => fnState.pending
  })

  Object.defineProperty(actionWrapper, 'error', {
    get: () => fnState.error
  })

  Object.defineProperty(actionWrapper, 'response', {
    get: () => fnState.response
  })

  Object.defineProperty(actionWrapper, 'success', {
    get: () => fnState.success
  })

  actionWrapper.trackedAction = true
  actionWrapper.reset = () =>
    runInAction(() => {
      fnState.pending = false
      fnState.success = false
      fnState.error = undefined
      fnState.response = undefined
    })

  if (baseDescriptor) {
    let firstRun = true

    return {
      configurable: true,
      get: function (this: any) {
        if (firstRun) {
          fn = fn.bind(this)
          firstRun = false
        }

        return actionWrapper
      },
      set(newFn: any) {
        fn = newFn
      }
    } as any
  } else {
    return actionWrapper
  }
}

const useAwaited = <T extends any>(
  promise: Promise<T>,
  options?: { onFulfill?: (result?: T, _err?: Error) => void, defaultValue?: T }
) => {
  const rawResult = getValue(promise, options?.defaultValue)
  const error = getError(promise)
  const loading = isPending(promise)

  const [memoResult, setMemoResult] = useState(rawResult)

  useEffect(() => {
    if (loading) return

    if (!error) {
      setMemoResult(rawResult)
    }

    options?.onFulfill?.(rawResult, error)
  }, [rawResult, loading, error])

  return {
    loading,
    error,
    rawResult,
    result: memoResult
  }
}

export {
  dependsOn,
  getError,
  getValue,
  isPending,
  resetter,
  succeeded,
  trackedAction,
  useAwaited
}
