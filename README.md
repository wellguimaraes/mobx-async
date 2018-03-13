# MobX Async
Experimental: improving Mobx with async capabilities

## Usage

Store
```js
import { observable } from 'mobx'
import { asyncAction } from 'mobx-async'

export default class TodoStore {
  @observable order = 'name'
  @observable anotherObservable = 'name'

  // Works just like a normal action, but
  // can have its status checked via
  // reloadItems.pending and eventual error on 
  // reloadItems.error
  @asyncAction async reloadItems(a, b, c) {
    // ...
  }
}
```

View
```jsx harmony
@observer
class TodoList extends React.Component {
  render() {
    const { store } = this.props

    return (
      <div>
        
        <button 
          onClick={ () => store.reloadItems() } 
          disabled={ store.reloadItems.pending }
        >
          Reload items
        </button>
        
        <Async value={ store.items }>
          { (items) => {
            
            if (items.pending)
              return <div>Loading items...</div>
              
            if (items.error)
              return <div>Failed to load items: {items.error.message}</div>
  
            return (
              <div>
                {items.value.map(it => <div>{it.title}</div>)}
              </div>
            )
          } }
        </Async>
        
      </div>
    )
  }
}
```
