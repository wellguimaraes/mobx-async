import { fromPromise } from 'mobx-utils'
import { action, observable } from 'mobx'

type AsyncItem = Promise<any> | (any & { asyncAction: boolean, pending: boolean })

export const isPending = (v: AsyncItem): boolean => {
  if (v.asyncAction)
    return v.pending

  return fromPromise(Promise.resolve(v))
    .case({
      fulfilled: () => false,
      pending: () => true,
      rejected: () => false,
    })
}

export const getError = (v: AsyncItem): Error | undefined => {
  if (v.asyncAction)
    return v.error

  return fromPromise(Promise.resolve(v))
    .case({
      fulfilled: () => undefined,
      pending: () => undefined,
      rejected: (err) => err,
    })
}

export const succeeded = (action: AsyncItem) => action && action.success

export const getValue = <T>(v: Promise<T>, defaultValue?: T) =>
  fromPromise(Promise.resolve(v)).case({
    fulfilled: (v) => v,
    pending: () => defaultValue,
    rejected: () => defaultValue,
  })

export const dependsOn = (..._: any[]) => {}

export function asyncAction(target: any, key: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value

  const fnState = observable.object({
    pending : false,
    success : false,
    error   : undefined,
    response: undefined
  })

  const actionWrapper: any = action(function () {
    fnState.pending  = true
    fnState.success  = false
    fnState.error    = undefined
    fnState.response = undefined

    return Promise
      // @ts-ignore
      .resolve(original.apply(this, arguments))
      .then(
        (response) => {
          fnState.pending  = false
          fnState.success  = true
          fnState.error    = undefined
          fnState.response = response
        },
        (err) => {
          fnState.response = undefined
          fnState.pending  = false
          fnState.error    = err
        }
      )
  }.bind(target))

  descriptor.value = actionWrapper

  Object.defineProperty(actionWrapper, 'asyncAction', {
    get: () => true
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

  actionWrapper.reset = () => {
    fnState.pending  = false
    fnState.success  = false
    fnState.error    = undefined
    fnState.response = undefined
  }

  return descriptor
}
