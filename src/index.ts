import { action, computed, observable, reaction } from 'mobx'

export interface AsyncComputedConfig {
  initialValue?: any
}

export interface AsyncComputed<T> extends Promise<any> {
  pending: boolean,
  error: Error | any,
  value: T
}

export function asyncComputed({ initialValue }: AsyncComputedConfig = {}) {
  return (target: any, key: string, descriptor: any) => {
    const originalGetter = descriptor.get

    const obsValue      = observable.box(initialValue)
    const obsPending    = observable.box(false)
    const obsError      = observable.box(undefined)
    const timeReference = observable.box(+new Date())

    async function computer() {
      obsPending.set(true)
      timeReference.get()

      try {
        if (typeof originalGetter === 'function') {
          // @ts-ignore
          const value = await originalGetter.call(this)
          obsValue.set(value)
          obsPending.set(false)
          obsError.set(undefined)
        }
      } catch (err) {
        obsPending.set(false)
        obsError.set(err)
      }
    }

    const computedObj = {} as any
    let firstTime     = true

    // noinspection JSUnresolvedFunction
    Object.defineProperty(target, '__' + key, computed(target, '__' + key, {
      enumerable: false,
      get() {
        if (firstTime) {
          firstTime = false
          obsPending.set(true)
          reaction(() => computer.call(computedObj.context), () => {
          })
        }

        return obsValue.get()
      }
    }) as any)

    const pendingPropDescriptor = computed(computedObj, 'pending', { get: () => obsPending.get() })

    computedObj.reset = () => {
      timeReference.set(+new Date())
    }

    // noinspection JSUnresolvedFunction
    Object.defineProperty(computedObj, 'pending', pendingPropDescriptor as any)

    // noinspection JSUnresolvedFunction
    Object.defineProperty(computedObj, 'error', computed(computedObj, 'error', { get: () => obsError.get() }) as any)

    // noinspection JSUnresolvedFunction
    Object.defineProperty(computedObj, 'value', computed(computedObj, 'value', {
      get() {
        return computedObj.context['__' + key]
      }
    }) as any)

    return computed(target, key, {
      get() {
        if (computedObj.context === undefined) {
          computedObj.context = this
        }

        return computedObj
      }
    })
  }
}

export function dependsOn(...anything: Array<any>) {
}

export function asyncAction(target: any, key: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value

  const fnState = observable<{ pending: boolean, success: boolean, error: any, response: any }>({
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