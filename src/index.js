import { action, observable } from 'mobx'
import _Async from './Async'

export const Async = _Async

export function dependsOn(anything) { }

export function asyncAction(target, key, descriptor) {
  const original = descriptor.value

  const fnState = observable({
    pending : false,
    success : false,
    error   : undefined,
    response: undefined
  })

  const actionWrapper = action(function () {
    fnState.pending  = true
    fnState.success  = false
    fnState.error    = undefined
    fnState.response = undefined

    return Promise
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
  })

  descriptor.value = actionWrapper

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