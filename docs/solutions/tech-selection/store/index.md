# Zustand StateCreator 完整使用指南

本文档展示了如何使用 Zustand 的 `StateCreator` 类型来构建类型安全的模块化状态管理方案。

## 🎯 核心优势

- **类型安全**：完整的 TypeScript 支持，无需 `any` 类型
- **模块化**：清晰的 slice 拆分和组合
- **跨模块通信**：类型安全的跨 slice 访问
- **简洁优雅**：使用官方推荐的 `StateCreator` API
- **可扩展**：易于添加新功能和中间件

## 📁 项目结构

```
stores/
├── app.store.ts          # 主 store 创建（直接展开组合）
├── types/
│   ├── store.types.ts    # 基础类型定义
│   └── app.types.ts      # 完整的 store 类型
├── slices/
│   ├── user.slice.ts     # 用户相关 slice
│   ├── cart.slice.ts     # 购物车 slice
│   ├── ui.slice.ts       # UI 状态 slice
│   └── product.slice.ts  # 商品状态 slice
└── utils/
    └── create-slice.ts   # 工具函数
```

## 🔧 基础类型定义

### 1. 核心类型 (stores/types/store.types.ts)

```typescript
import type { StateCreator } from 'zustand'

// Store 的基础结构
type AppStore = {
  user: UserSlice
  cart: CartSlice
  ui: UISlice
  product: ProductSlice
}

// Slice 创建器类型
export type SliceCreator<T> = StateCreator<
  AppStore,
  [['zustand/immer', never]],
  [],
  T
>
```

### 2. 数据模型类型

```typescript
// 用户相关
type User = {
  id: string
  name: string
  email: string
  avatar?: string
  preferences: {
    theme: 'light' | 'dark'
    language: string
    notifications: boolean
  }
}

// 购物车商品
type CartItem = {
  id: string
  productId: string
  name: string
  price: number
  quantity: number
  image?: string
  userId?: string
}

// 商品信息
type Product = {
  id: string
  name: string
  price: number
  description: string
  category: string
  inStock: boolean
  images: string[]
}
```

## 🍕 Slice 定义示例

### 用户 Slice (stores/slices/user.slice.ts)

```typescript
import type { SliceCreator } from '../types/store.types'

export type UserSlice = {
  user: User | null
  isLoggedIn: boolean
  isLoading: boolean
  setUser: (user: User | null) => void
  updateUser: (updates: Partial<Omit<User, 'id'>>) => void
  updatePreferences: (preferences: Partial<User['preferences']>) => void
  getUserId: () => string | null
}

export const createUserSlice: SliceCreator<UserSlice> = (set, get) => ({
  // 状态
  user: null,
  isLoggedIn: false,
  isLoading: false,

  // 动作
  setUser: (user) => set((state) => {
    state.user = user
    state.isLoggedIn = !!user
    
    // 跨 slice 通信 - 完全类型安全
    if (user) {
      state.setTheme(user.preferences.theme)
      state.loadUserCart(user.id)
    } else {
      state.clearCart()
    }
  }),

  updateUser: (updates) => set((state) => {
    if (state.user) {
      Object.assign(state.user, updates)
    }
  }),

  updatePreferences: (preferences) => set((state) => {
    if (state.user) {
      Object.assign(state.user.preferences, preferences)
      state.setTheme(state.user.preferences.theme)
    }
  }),

  getUserId: () => get().user?.id || null
})
```

### 购物车 Slice (stores/slices/cart.slice.ts)

```typescript
import type { SliceCreator } from '../types/store.types'

export type CartSlice = {
  items: CartItem[]
  isLoading: boolean
  error: string | null
  addItem: (item: Omit<CartItem, 'id' | 'userId'>) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  loadUserCart: (userId: string) => Promise<void>
  syncCartToServer: () => Promise<void>
  getTotalPrice: () => number
  getTotalItems: () => number
}

export const createCartSlice: SliceCreator<CartSlice> = (set, get) => ({
  items: [],
  isLoading: false,
  error: null,

  addItem: (item) => set((state) => {
    const userId = get().getUserId()
    const existing = state.items.find(i => i.productId === item.productId)
    
    if (existing) {
      existing.quantity += item.quantity
    } else {
      state.items.push({
        ...item,
        id: Date.now().toString(),
        userId
      })
    }
    
    if (userId) {
      state.syncCartToServer()
    }
  }),

  removeItem: (productId) => set((state) => {
    state.items = state.items.filter(item => item.productId !== productId)
    
    const userId = get().getUserId()
    if (userId) {
      state.syncCartToServer()
    }
  }),

  getTotalPrice: () => {
    return get().items.reduce((total, item) => 
      total + (item.price * item.quantity), 0
    )
  },

  getTotalItems: () => {
    return get().items.reduce((total, item) => total + item.quantity, 0)
  }
})
```

### UI Slice (stores/slices/ui.slice.ts)

```typescript
import type { SliceCreator } from '../types/store.types'

export type UISlice = {
  theme: 'light' | 'dark'
  sidebarOpen: boolean
  notifications: Array<{
    id: string
    message: string
    type: 'success' | 'error' | 'info' | 'warning'
    duration?: number
  }>
  setTheme: (theme: 'light' | 'dark') => void
  toggleSidebar: () => void
  addNotification: (notification: Omit<UISlice['notifications'][0], 'id'>) => void
  removeNotification: (id: string) => void
}

export const createUISlice: SliceCreator<UISlice> = (set, get) => ({
  theme: 'light',
  sidebarOpen: false,
  notifications: [],

  setTheme: (theme) => set((state) => {
    state.theme = theme
    
    // 同步更新用户偏好
    const user = get().user
    if (user && user.preferences.theme !== theme) {
      get().updateUser({ preferences: { ...user.preferences, theme } })
    }
  }),

  toggleSidebar: () => set((state) => {
    state.sidebarOpen = !state.sidebarOpen
  }),

  addNotification: (notification) => set((state) => {
    const id = Date.now().toString()
    state.notifications.push({ ...notification, id })
    
    setTimeout(() => {
      get().removeNotification(id)
    }, notification.duration || 3000)
  }),

  removeNotification: (id) => set((state) => {
    state.notifications = state.notifications.filter(n => n.id !== id)
  })
})
```

## 🏗️ 主 Store 创建

### stores/app.store.ts

```typescript
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'
import { devtools } from 'zustand/middleware'
import type { AppStore } from './types/store.types'

import { createUserSlice } from './slices/user.slice'
import { createCartSlice } from './slices/cart.slice'
import { createUISlice } from './slices/ui.slice'
import { createProductSlice } from './slices/product.slice'

export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      immer((...a) => ({
        ...createUserSlice(...a),
        ...createCartSlice(...a),
        ...createUISlice(...a),
        ...createProductSlice(...a),
      })),
      {
        name: 'app-store',
        partialize: (state) => ({
          user: state.user,
          isLoggedIn: state.isLoggedIn,
          theme: state.theme,
          items: state.items
        })
      }
    ),
    {
      name: 'app-store',
      enabled: process.env.NODE_ENV === 'development'
    }
  )
)

// 创建类型安全的选择器
export const useUser = () => useAppStore(state => ({
  user: state.user,
  isLoggedIn: state.isLoggedIn,
  isLoading: state.isLoading,
  setUser: state.setUser,
  updateUser: state.updateUser,
  updatePreferences: state.updatePreferences,
  getUserId: state.getUserId
}))

export const useCart = () => useAppStore(state => ({
  items: state.items,
  isLoading: state.isLoading,
  error: state.error,
  addItem: state.addItem,
  removeItem: state.removeItem,
  updateQuantity: state.updateQuantity,
  clearCart: state.clearCart,
  loadUserCart: state.loadUserCart,
  syncCartToServer: state.syncCartToServer,
  getTotalPrice: state.getTotalPrice,
  getTotalItems: state.getTotalItems
}))

export const useUI = () => useAppStore(state => ({
  theme: state.theme,
  sidebarOpen: state.sidebarOpen,
  notifications: state.notifications,
  setTheme: state.setTheme,
  toggleSidebar: state.toggleSidebar,
  addNotification: state.addNotification,
  removeNotification: state.removeNotification
}))

export const useProduct = () => useAppStore(state => ({
  products: state.products,
  isLoading: state.isLoading,
  error: state.error,
  selectedCategory: state.selectedCategory,
  setProducts: state.setProducts,
  setLoading: state.setLoading,
  setError: state.setError,
  setSelectedCategory: state.setSelectedCategory,
  getProductById: state.getProductById,
  getProductsByCategory: state.getProductsByCategory
}))

export const useStore = () => useAppStore()
```

## 🎨 使用示例

### 在组件中使用

```typescript
// components/UserProfile.tsx
import * as React from 'react'
import { useUser } from '../stores/app.store'

export function UserProfile({}: UserProfileProps) {
  const { user, isLoading, updateUser } = useUser()

  const handleUpdateName = React.useCallback((newName: string) => {
    updateUser({ name: newName })
  }, [updateUser])

  if (isLoading) {
    return <view>Loading...</view>
  }

  return (
    <view>
      <text>Welcome, {user?.name || 'Guest'}!</text>
      <button onClick={() => handleUpdateName('New Name')}>
        Update Name
      </button>
    </view>
  )
}

// components/CartSummary.tsx
import * as React from 'react'
import { useCart } from '../stores/app.store'

export function CartSummary({}: CartSummaryProps) {
  const { items, getTotalPrice, removeItem } = useCart()

  return (
    <view>
      <text>Total: ${getTotalPrice()}</text>
      {items.map(item => (
        <view key={item.id}>
          <text>{item.name} - ${item.price}</text>
          <button onClick={() => removeItem(item.id)}>
            Remove
          </button>
        </view>
      ))}
    </view>
  )
}

// components/ThemeToggle.tsx
import * as React from 'react'
import { useUI } from '../stores/app.store'

export function ThemeToggle({}: ThemeToggleProps) {
  const { theme, setTheme } = useUI()

  return (
    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      Switch to {theme === 'light' ? 'dark' : 'light'} theme
    </button>
  )
}

// 跨模块访问示例
// components/UserCartSync.tsx
import * as React from 'react'
import { useAppStore } from '../stores/app.store'

export function UserCartSync({}: UserCartSyncProps) {
  const store = useAppStore()

  React.useEffect(() => {
    // 跨模块访问：用户登录后加载购物车
    if (store.user && store.isLoggedIn) {
      store.loadUserCart(store.user.id)
    }
  }, [store.user, store.isLoggedIn])

  return null
}
```

### 在业务逻辑中使用

```typescript
import { useUser, useCart, useStore } from '@/stores/app.store'

export function useProductActions() {
  const user = useUser()
  const cart = useCart()
  
  const handleAddToCart = (productId: string) => {
    // 完全类型安全的使用
    const product = useStore.getState().getProductById(productId)
    if (product) {
      cart.addItem({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1
      })
    }
  }
  
  const handleLogout = () => {
    user.setUser(null)
  }
  
  return { handleAddToCart, handleLogout }
}
```
```

### 跨模块操作

```typescript
// 用户登录时的跨模块操作
const handleLogin = async (credentials: LoginCredentials) => {
  const response = await authService.login(credentials)
  
  // 一次性更新多个模块
  useStore.setState(state => {
    state.setUser(response.user)
    state.setTheme(response.user.preferences.theme)
    state.loadUserCart(response.user.id)
  })
}
```

## 📋 最佳实践

### 1. 模块拆分原则
- 每个 slice 应该管理单一领域的逻辑
- 保持 slice 的独立性，减少耦合
- 使用清晰的命名约定，避免状态字段冲突

### 2. 类型安全
- 始终使用 `StateCreator` 定义类型
- 避免使用 `any` 类型
- 为所有状态和方法提供完整的类型定义

### 3. 跨模块通信
- 使用 `get()` 方法访问其他模块的状态
- 使用 `set()` 方法触发跨模块操作
- 保持通信的明确性和可追踪性

### 4. 性能优化
- 使用细粒度的选择器 hooks
- 避免在 render 中直接调用 `getState()`
- 合理使用持久化配置
- 使用直接展开方式组合 store，避免嵌套层级

### 5. 命名规范
- 状态字段使用小驼峰命名
- 方法使用动词开头，如 `setUser`、`addItem`
- 避免不同 slice 间使用相同的字段名
- 推荐使用模块前缀或命名空间区分不同 slice 的方法

## 🚀 扩展功能

### 添加新的 Slice

```typescript
// stores/slices/analytics.slice.ts
export type AnalyticsSlice = {
  events: AnalyticsEvent[]
  trackEvent: (event: Omit<AnalyticsEvent, 'id'>) => void
}

export const createAnalyticsSlice: SliceCreator<AnalyticsSlice> = (set, get) => ({
  events: [],
  trackEvent: (event) => set((state) => {
    state.events.push({
      ...event,
      id: Date.now().toString(),
      userId: get().getUserId()
    })
  })
})
```

### 添加到主 Store

```typescript
// stores/app.store.ts
export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      immer((...a) => ({
        ...createUserSlice(...a),
        ...createCartSlice(...a),
        ...createUISlice(...a),
        ...createProductSlice(...a),
        ...createAnalyticsSlice(...a), // 新增
      }))
    )
  )
)
```

## ❓ 常见问题与解决方案

### 问题1: 在 useEffect 中使用状态最新值但不想作为依赖项

**问题描述**：想在 `useEffect` 中使用某个状态的最新值，但又不想将其作为依赖项，避免不必要的重渲染。

**解决方案**：使用 `useStore.getState()` 获取最新状态值

```typescript
import { useAppStore } from '@/stores/app.store'

export function MyComponent({}: MyComponentProps) {
  const { setUser } = useUser()
  
  React.useEffect(() => {
    // ❌ 错误方式：将 user 作为依赖项，会导致不必要的重渲染
    // const user = useUser().user
    
    // ✅ 正确方式：使用 getState 获取最新值
    const user = useAppStore.getState().user
    if (user) {
      // 使用最新的 user 值，但不触发重渲染
      console.log('Current user:', user.name)
    }
  }, []) // 空依赖数组，只在组件挂载时执行
  
  return null
}
```

### 问题2: 在 React 组件外获取当前最新状态

**问题描述**：需要在 React 组件外部（如工具函数、事件处理函数等）获取 store 的最新状态。

**解决方案**：直接使用 `getState()` 方法

```typescript
// utils/auth.ts
import { useAppStore } from '@/stores/app.store'

export function checkUserPermission(permission: string): boolean {
  // 在任何地方都可以直接获取最新状态
  const { user, isLoggedIn } = useAppStore.getState()
  
  if (!isLoggedIn || !user) return false
  
  return user.permissions.includes(permission)
}

// 在 API 调用中使用
export async function apiCall(endpoint: string) {
  const { user } = useAppStore.getState()
  const token = user?.token
  
  return fetch(endpoint, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
}
```

### 问题3: 在 React 组件外监听状态变化

**问题描述**：需要在 React 组件外部监听 Zustand store 的变化，包括整个 store 或特定字段。

**解决方案**：使用 `subscribe` 方法，支持多种监听模式

```typescript
// 在任意地方监听状态变化
export function setupStateListeners() {
  // 方式1：监听整个 store 的所有变化
  const unsubscribeAll = useAppStore.subscribe(
    (state) => state, // 返回整个 state 对象
    (state, prevState) => {
      console.log('store 发生变化:', state, prevState)
      // 这里可以检测到任何字段的变化
    }
  )
  
  // 方式2：监听特定字段的变化（推荐，性能更好）
  const unsubscribeTheme = useAppStore.subscribe(
    (state) => state.theme, // 只返回 theme 字段
    (theme, prevTheme) => {
      console.log('主题变化:', prevTheme, '->', theme)
      document.documentElement.setAttribute('data-theme', theme)
    }
  )
  
  // 方式3：监听嵌套字段的变化
  const unsubscribeUserId = useAppStore.subscribe(
    (state) => state.user?.id, // 只返回 user.id
    (userId, prevUserId) => {
      if (userId !== prevUserId) {
        console.log('用户 ID 变化:', prevUserId, '->', userId)
        
        if (userId) {
          // 用户切换时的操作
          useAppStore.getState().loadUserCart(userId)
          useAppStore.getState().loadUserPreferences(userId)
        }
      }
    }
  )
  
  return () => {
    unsubscribeAll()
    unsubscribeTheme()
    unsubscribeUserId()
  }
}

// 使用示例
setupStateListeners()
```

### 问题4: 使用 Provider 创建独立 store 实例

**问题描述**：封装组件时，希望每个组件实例有独立的 store，避免状态共享。

**解决方案**：使用 `zustand/context` 创建独立的 store 实例

```typescript
// stores/counter.store.ts
import { createContext } from 'zustand/context'
import { createStore } from 'zustand'

// 定义状态类型
type CounterState = {
  count: number
  isLoading: boolean
  increment: () => void
  decrement: () => void
  reset: () => void
}

// 创建 store 逻辑
const createCounterStore = () => createStore<CounterState>((set) => ({
  count: 0,
  isLoading: false,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
  reset: () => set({ count: 0, isLoading: false })
}))

// 使用 zustand/context 创建 Context
const { 
  Provider: CounterProvider, 
  useStore: useCounterStore,
  useStoreApi: useCounterStoreApi  // 获取 store 实例
} = createContext<CounterState>()

// 导出 Provider 组件
export { CounterProvider, useCounterStore, useCounterStoreApi }

// 使用示例
export function CounterButton({}: CounterButtonProps) {
  return (
    <CounterProvider createStore={createCounterStore}>
      <Counter />
    </CounterProvider>
  )
}

function Counter({}: CounterProps) {
  const { count, increment, decrement } = useCounterStore((state) => ({
    count: state.count,
    increment: state.increment,
    decrement: state.decrement
  }))
  
  return (
    <view style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button onClick={decrement}>
        <text>-</text>
      </button>
      <text>Count: {count}</text>
      <button onClick={increment}>
        <text>+</text>
      </button>
    </view>
  )
}
```

**useStore vs useStoreApi 的区别**

在 `zustand/context` 中，提供了两个不同的 hook：

| 特性           | `useStore`                             | `useStoreApi`                 |
| -------------- | -------------------------------------- | ----------------------------- |
| **主要用途**   | 读取状态                               | 获取 store 实例               |
| **触发重渲染** | ✅ 会触发                               | ❌ 不会触发                    |
| **返回值**     | 选择的状态值                           | 完整的 store 实例             |
| **使用场景**   | 组件内读取状态                         | 组件外操作状态                |
| **示例**       | `const count = useStore(s => s.count)` | `const store = useStoreApi()` |

```typescript
// useStore - 用于组件内读取状态
function CounterDisplay({}: CounterDisplayProps) {
  const count = useCounterStore((state) => state.count)
  return <text>Count: {count}</text>
}

// useStoreApi - 用于获取 store 实例
function CounterControls({}: CounterControlsProps) {
  const store = useCounterStoreApi()
  
  // 在事件处理函数中使用 store
  const handleReset = () => {
    store.getState().reset()
  }
  
  const handleIncrementAsync = () => {
    // 在异步操作中使用 store
    setTimeout(() => {
      store.getState().increment()
    }, 1000)
  }
  
  return (
    <view>
      <button onClick={handleReset}>
        <text>重置</text>
      </button>
      <button onClick={handleIncrementAsync}>
        <text>异步增加</text>
      </button>
    </view>
  )
}
```

**进阶用法：带初始值的 Provider**

```typescript
// 支持传入初始值的 Provider
export function CounterButtonWithInitial({ initialCount = 0 }: { initialCount?: number }) {
  return (
    <CounterProvider 
      createStore={() => createCounterStore()} 
      initialState={{ count: initialCount, isLoading: false }}
    >
      <Counter />
    </CounterProvider>
  )
}
```

## 🔧 中间件与扩展功能详解

### Persist 中间件（持久化）

**基础用法**：

```typescript
import { persist } from 'zustand/middleware'

export const useAppStore = create<AppStore>()(
  persist(
    immer((...a) => ({
      ...createUserSlice(...a),
      ...createCartSlice(...a),
    })),
    {
      name: 'app-storage', // 存储键名
      
      // 选择性持久化
      partialize: (state) => ({
        user: state.user,
        theme: state.theme,
        cartItems: state.items
      }),
      
      // 版本控制
      version: 1,
      migrate: (persistedState, version) => {
        if (version === 0) {
          // 迁移旧数据到新格式
          return {
            ...persistedState,
            theme: persistedState.theme || 'light'
          }
        }
        return persistedState
      },
      
      // 自定义存储
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          return str ? JSON.parse(str) : null
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value))
        },
        removeItem: (name) => localStorage.removeItem(name)
      }
    }
  )
)
```

### Immer 中间件（不可变更新）

**高级用法**：

```typescript
import { immer } from 'zustand/middleware/immer'

// 启用 Immer 的 Map 和 Set 支持
import { enableMapSet } from 'immer'
enableMapSet()

export const useAppStore = create<AppStore>()(
  immer((set, get) => ({
    // 使用 Map 和 Set
    userMap: new Map<string, User>(),
    
    addUser: (user: User) => set((state) => {
      state.userMap.set(user.id, user)
    }),
    
    // 嵌套对象更新
    settings: {
      notifications: {
        email: true,
        push: false
      }
    },
    
    updateNotificationSettings: (type: 'email' | 'push', enabled: boolean) => 
      set((state) => {
        state.settings.notifications[type] = enabled
      })
  }))
)
```

### Redo/Undo 中间件（撤销/重做）

**实现方式**：

```typescript
import { temporal } from 'zundo'

// 定义 undo/redo 状态
type UndoState = {
  undo: () => void
  redo: () => void
  clear: () => void
  canUndo: boolean
  canRedo: boolean
}

export const useAppStore = create<AppStore & UndoState>()(
  temporal(
    immer((set, get) => ({
      // 你的业务状态
      ...createUserSlice(...a),
      ...createCartSlice(...a),
      
      // undo/redo 方法
      undo: () => useAppStore.temporal.getState().undo(),
      redo: () => useAppStore.temporal.getState().redo(),
      clear: () => useAppStore.temporal.getState().clear(),
      canUndo: false,
      canRedo: false,
    })),
    {
      // 配置选项
      limit: 100, // 最大历史记录数
      partialize: (state) => ({
        // 只跟踪特定状态
        cart: state.items,
        user: state.user
      }),
      equality: (a, b) => JSON.stringify(a) === JSON.stringify(b)
    }
  )
)

// 使用示例
export function UndoRedoControls({}: UndoRedoControlsProps) {
  const { undo, redo, canUndo, canRedo } = useAppStore()
  
  return (
    <view>
      <button disabled={!canUndo} onClick={undo}>
        <text>撤销</text>
      </button>
      <button disabled={!canRedo} onClick={redo}>
        <text>重做</text>
      </button>
    </view>
  )
}
```

### subscribeWithSelector 中间件（选择器订阅）

**作用**：启用 `subscribe` 方法的高级选择器功能，允许精确监听状态变化。

**为什么需要**：
- 原生 `subscribe` 只能监听整个 store 变化
- 使用选择器后，只会在特定字段变化时触发回调
- 大幅提升性能，避免不必要的重渲染

**使用方式**：

```typescript
import { subscribeWithSelector } from 'zustand/middleware'

export const useAppStore = create<AppStore>()(
  subscribeWithSelector(
    immer((...a) => ({
      ...createUserSlice(...a),
      ...createCartSlice(...a),
      ...createUISlice(...a),
    }))
  )
)
```

**实际应用示例**：

```typescript
// 监听特定字段变化（需要 subscribeWithSelector）
const unsubscribe = useAppStore.subscribe(
  (state) => state.user?.id,  // 选择器函数
  (userId, prevUserId) => {
    if (userId !== prevUserId) {
      console.log('用户ID变化:', prevUserId, '->', userId)
      // 只在 user.id 变化时触发
    }
  }
)

// 监听多个字段组合
const unsubscribeCart = useAppStore.subscribe(
  (state) => ({
    items: state.items,
    total: state.total
  }),
  ({ items, total }, prev) => {
    if (items.length !== prev.items.length) {
      console.log('购物车商品数量变化:', items.length)
    }
  }
)
```

**与原生 subscribe 的区别**：

| 特性           | 原生 subscribe | subscribeWithSelector |
| -------------- | -------------- | --------------------- |
| **监听粒度**   | 整个 store     | 精确到字段级别        |
| **性能**       | 较差           | 优秀                  |
| **选择器支持** | ❌ 不支持       | ✅ 支持                |
| **使用场景**   | 简单监听       | 复杂状态监听          |

### 组合多个中间件

**完整示例**：

```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { subscribeWithSelector } from 'zustand/middleware'

export const useAppStore = create<AppStore>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((...a) => ({
          ...createUserSlice(...a),
n          ...createCartSlice(...a),
          ...createUISlice(...a),
        })),
        {
          name: 'app-store',
          partialize: (state) => ({
            user: state.user,
            theme: state.theme,
            cart: state.items
          })
        }
      )
    ),
    {
      name: 'app-store',
      enabled: process.env.NODE_ENV === 'development'
    }
  )
)
```

## 📚 相关资源

- [Zustand 官方文档](https://docs.pmnd.rs/zustand)
- [TypeScript 类型定义](https://docs.pmnd.rs/zustand/guides/typescript)
- [Immer 中间件](https://docs.pmnd.rs/zustand/integrations/immer-middleware)
- [持久化中间件](https://docs.pmnd.rs/zustand/integrations/persisting-store-data)
- [Undo/Redo 扩展](https://github.com/charkour/zundo)

---

这个方案提供了完整的类型安全、模块化和可扩展的状态管理解决方案，包括常见问题解答和高级中间件用法，适合中大型项目的开发需求。
