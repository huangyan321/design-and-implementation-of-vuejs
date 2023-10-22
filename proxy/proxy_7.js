/** @format */

// 代理Set Map
/** @format */

let activeEffect;
const ITERATE_KEY = Symbol();
const MAP_KEYS_ITERATE_KEY = Symbol();
const RAW = Symbol(); //防止用户属性冲突
const effectStack = [];
const TriggerType = {
  SET: 'SET',
  ADD: 'ADD',
  DELETE: 'DELETE',
};
// 是否允许响应式追踪
let shouldTrack = true;
const reactiveMap = new Map();
const bucket = new WeakMap();
function track(target, key) {
  // 禁止追踪时 直接返回
  if (!activeEffect || !shouldTrack) return;
  let depsMap = bucket.get(target);
  if (!depsMap) bucket.set(target, (depsMap = new Map()));
  let deps = depsMap.get(key);
  if (!deps) depsMap.set(key, (deps = new Set()));
  deps.add(activeEffect);
  activeEffect.deps.push(deps);
}
function trigger(target, key, type, newValue) {
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  const effects = depsMap.get(key);
  const effectsToRun = new Set();
  if (Array.isArray(target) && key === 'length') {
    depsMap.forEach((effects, key) => {
      if (key >= newValue) {
        effects &&
          effects.forEach((effect) => {
            if (effect !== activeEffect) {
              effectsToRun.add(effect);
            }
          });
      }
    });
  } else {
    effects &&
      effects.forEach((effect) => {
        if (effect !== activeEffect) {
          effectsToRun.add(effect);
        }
      });
  }

  if (type === TriggerType.ADD && Array.isArray(target)) {
    // 取得与length相关联的函数
    const lengthEffects = depsMap.get('length');
    lengthEffects &&
      lengthEffects.forEach((effect) => {
        if (effect !== activeEffect) {
          effectsToRun.add(effect);
        }
      });
  }

  // 只有新增属性时才会触发ITERATE_KEY相关联函数执行
  if (
    type === TriggerType.ADD ||
    type === TriggerType.DELETE ||
    (type === TriggerType.SET &&
      Object.prototype.toString.call(target) === '[object Map]')
  ) {
    // 取得与ITERATE_KEY相关联的函数
    const iterateEffects = depsMap.get(ITERATE_KEY);
    iterateEffects &&
      iterateEffects.forEach((effect) => {
        if (effect !== activeEffect) {
          effectsToRun.add(effect);
        }
      });
  }
  // 只有新增属性时才会触发ITERATE_KEY相关联函数执行
  if (
    (type === TriggerType.ADD || type === TriggerType.DELETE) &&
    Object.prototype.toString.call(target) === '[object Map]'
  ) {
    // 取得与ITERATE_KEY相关联的函数
    const iterateEffects = depsMap.get(MAP_KEYS_ITERATE_KEY);
    iterateEffects &&
      iterateEffects.forEach((effect) => {
        if (effect !== activeEffect) {
          effectsToRun.add(effect);
        }
      });
  }
  effectsToRun.forEach((effectFn) => {
    // 如果存在调度器，则使用调度器执行该副作用函数
    if (effectFn.options && effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn);
    } else {
      // 不存在则默认立即执行
      effectFn();
    }
  });
}
function cleanup(effectFn) {
  const deps = effectFn.deps;
  for (let i = 0; i < deps.length; i++) {
    const deps = effectFn.deps[i];
    deps.delete(effectFn);
  }
  deps.length = 0;
}
function effect(fn, options = {}) {
  const effectFn = () => {
    cleanup(effectFn);
    activeEffect = effectFn;
    effectStack.push(effectFn);
    const res = fn();
    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];
    return res;
  };
  effectFn.deps = [];
  // 挂载选项（含调度器）
  effectFn.options = options;
  if (!options.lazy) {
    effectFn();
  }
  return effectFn;
}
function iteratorMethod() {
  const wrap = (val) => (typeof val === 'object' ? reactive(val) : val);
  const target = this[RAW];
  const itr = target[Symbol.iterator]();
  track(target, ITERATE_KEY);
  return {
    // 迭代器协议
    next() {
      const { value, done } = itr.next();
      return {
        value: value ? [wrap(value[0]), [wrap(value[1])]] : value,
        done,
      };
    },
    // 可迭代协议
    [Symbol.iterator]() {
      return this;
    },
  };
}
function valuesIteratorMethod() {
  const wrap = (val) => (typeof val === 'object' ? reactive(val) : val);
  const target = this[RAW];
  const itr = target.values();
  track(target, ITERATE_KEY);
  return {
    // 迭代器协议
    next() {
      const { value, done } = itr.next();
      return {
        // value是值 而非键值对，所以只需包裹value即可
        value: wrap(value),
        done,
      };
    },
    // 可迭代协议
    [Symbol.iterator]() {
      return this;
    },
  };
}
function keysIteratorMethod() {
  const wrap = (val) => (typeof val === 'object' ? reactive(val) : val);
  const target = this[RAW];
  const itr = target.keys();
  track(target, MAP_KEYS_ITERATE_KEY);
  return {
    // 迭代器协议
    next() {
      const { value, done } = itr.next();
      return {
        // value是值 而非键值对，所以只需包裹value即可
        value: wrap(value),
        done,
      };
    },
    // 可迭代协议
    [Symbol.iterator]() {
      return this;
    },
  };
}
const mutableInstrumentations = {
  [Symbol.iterator]: iteratorMethod,
  entires: iteratorMethod,
  values: valuesIteratorMethod,
  keys: keysIteratorMethod,
  add(key) {
    const target = this[RAW];
    const hadKey = target.has(key);
    const res = target.add(key);
    if (!hadKey) {
      trigger(target, key, TriggerType.ADD);
    }
    return res;
  },
  delete(key) {
    const target = this[RAW];
    const hadKey = target.has(key);
    const res = target.delete(key);
    if (hadKey) {
      trigger(target, key, TriggerType.DELETE);
    }
    return res;
  },
  get(key) {
    const target = this[RAW];
    const hadKey = target.has(key);
    track(target, key);
    if (hadKey) {
      const res = target.get(key);
      return typeof res === 'object' ? reactive(res) : res;
    }
  },
  set(key, value) {
    const target = this[RAW];
    const had = target.has(key);
    const oldValue = target.get(key);
    // 将原始数据复制到target，避免数据污染
    const rawValue = value[RAW] || value;
    target.set(key, rawValue);
    if (!had) {
      trigger(target, key, TriggerType.ADD);
    } else if (
      oldValue !== value &&
      (oldValue === oldValue || value === value)
    ) {
      trigger(target, key, TriggerType.SET);
    }
  },
  forEach(callback) {
    const wrap = (val) => (typeof val === 'object' ? reactive(val) : val);
    const target = this[RAW];
    track(target, ITERATE_KEY);
    target.forEach((v, k) => {
      callback(wrap(v), wrap(k), this);
    });
  },
};
function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      if (key === RAW) return target;
      if (key === 'size') {
        track(target, ITERATE_KEY);
        return Reflect.get(target, key, target);
      }
      return mutableInstrumentations[key];
    },
    set(target, key, newValue, receiver) {
      if (isReadonly) {
        console.warn(`property ${key} is readonly`);
        return true;
      }
      const oldValue = target[key];
      const type = Array.isArray(target)
        ? Number(key) < target.length
          ? TriggerType.SET
          : TriggerType.ADD
        : Object.prototype.hasOwnProperty.call(target, key)
        ? TriggerType.SET
        : TriggerType.ADD;
      const res = Reflect.set(target, key, newValue, receiver);
      // 防止当代理对象的原型为响应式对象时重复触发set的行为
      // 原理：访问代理对象时receiver恒为原始对象的代理对象而不是原型的代理对象
      // 如果target === receiver.raw说明receiver是target的代理对象，
      if (target === receiver[RAW]) {
        // 增加判断NaN的条件
        if (
          oldValue !== newValue &&
          (oldValue === oldValue || newValue === newValue)
        ) {
          trigger(target, key, type, newValue);
        }
      }

      return res;
    },
    // 拦截in 操作符
    has(target, key) {
      track(target, key);
      return Reflect.has(target, key);
    },
    // 拦截for in 循环
    ownKeys(target) {
      // 数组 for in 循环时触发拦截 并使用 length 绑定副作用函数(因为影响for in 循环的总是数组的长度)
      track(target, Array.isArray(target) ? 'length' : ITERATE_KEY);
      return Reflect.ownKeys(target);
    },
    deleteProperty(target, key) {
      if (isReadonly) {
        console.warn(`property ${key} is readonly`);
        return true;
      }
      const hadKey = Object.prototype.hasOwnProperty.call(target, key);
      const res = Reflect.deleteProperty(target, key);
      if (res && hadKey) {
        trigger(target, key, 'DELETE');
      }
      return res;
    },
  });
}
function reactive(obj) {
  // 防止多次为obj创建不同的响应式对象
  const existProxy = reactiveMap.get(obj);
  if (existProxy) return existProxy;

  const proxy = createReactive(obj, false);
  reactiveMap.set(obj, proxy);
  return proxy;
}

// const set = new Set([1, 2, 3]);
// const proxySet = reactive(set);

// effect(() => {
//   console.log(proxySet.size);
// });
// proxySet.add(4);
// proxySet.delete(4);

// const map = new Map([
//   ['foo', 1],
//   ['bar', NaN],
// ]);
// const proxyMap = reactive(map);
// effect(() => {
//   // console.log(proxyMap.size);
//   console.log(proxyMap.get('bar'));
// });

// // proxyMap.set('foo1', 11);
// proxyMap.set('bar', NaN);

// const map = new Map([
//   ['foo', 1],
//   ['bar', NaN],
// ]);
// const proxyMap = reactive(map);

// effect(() => {
//   for (const [key, value] of proxyMap) {
//     console.log(key, value);
//   }
// });
// proxyMap.set('key', 'value');

// const map = new Map([
//   ['foo', 1],
//   ['bar', NaN],
// ]);
// const proxyMap = reactive(map);

// effect(() => {
//   for (const value of proxyMap.keys()) {
//     console.log(value);
//   }
// });
// proxyMap.set('key', 'value');
// proxyMap.set('foo', '11');
