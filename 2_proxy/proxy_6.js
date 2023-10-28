/** @format */

// 代理数组
/** @format */

let activeEffect;
const ITERATE_KEY = Symbol();
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
  if (type === TriggerType.ADD || type === TriggerType.DELETE) {
    // 取得与ITERATE_KEY相关联的函数
    const iterateEffects = depsMap.get(ITERATE_KEY);
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
const originMethod = Array.prototype.includes;
const arrayInstrumentations = {};
['includes', 'indexOf', 'lastIndexOf'].forEach((method) => {
  const originMethod = Array.prototype[method];
  arrayInstrumentations[method] = function (...args) {
    let res = originMethod.apply(this, args);
    if (res === false || res === -1) {
      res = originMethod.apply(this.raw, args);
    }
    return res;
  };
});
// 重写'pop', 'push', 'shift', 'unshift', 'splice'方法，由于其内部方法会读取length属性，这会间接导致一些更新问题，且其语义上是设置属性，故在push执行时不进行追踪
['pop', 'push', 'shift', 'unshift', 'splice'].forEach((method) => {
  const originMethod = Array.prototype[method];
  arrayInstrumentations[method] = function (...args) {
    // 禁止追踪
    shouldTrack = false;
    let res = originMethod.apply(this, args);
    // 允许追踪
    shouldTrack = true;
    return res;
  };
});
function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      // 可通过raw访问原始数据
      if (key === 'raw') return target;

      // 如果target是数组，则返回重写方法
      if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
        return Reflect.get(arrayInstrumentations, key, receiver);
      }
      // 不对key为symbol的属性进行追踪
      if (!isReadonly && typeof key !== 'symbol') track(target, key);

      const res = Reflect.get(target, key, receiver);
      if (isShallow) return res;
      if (typeof res === 'object' && res !== null) {
        return isReadonly ? readonly(res) : reactive(res);
      }
      // 这里的receiver 相当于this,将target的this绑定在了代理的对象obj上,这样在原始对象中访问的this就是代理对象,就能够进行依赖收集
      return res;
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
      if (target === receiver.raw) {
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
function readonly(obj) {
  return createReactive(obj, false, true);
}
function shallowReadonly(obj) {
  return createReactive(obj, true, true);
}
function reactive(obj) {
  // 防止多次为obj创建不同的响应式对象
  const existProxy = reactiveMap.get(obj);
  if (existProxy) return existProxy;

  const proxy = createReactive(obj, false);
  reactiveMap.set(obj, proxy);
  return proxy;
}
function shallowReactive(obj) {
  return createReactive(obj, true);
}
// const arr = reactive([1, 2, 3]);

// effect(() => {
//   console.log('运行副作用函数1', arr.length);
// });
// // 当索引值大于arr长度时，此时需要触发跟length相关联的副作用函数
// // arr[10] = 22;
// effect(() => {
//   console.log('运行副作用函数1', arr[0]);
// });

// effect(() => {
//   console.log('运行副作用函数2', arr[1]);
// });
// effect(() => {
//   console.log('运行副作用函数3', arr[2]);
// });

// arr.length = 3;

// effect(() => {
//   for (const item of arr) {
//     console.log(item);
//   }
// });
// arr.length = 5;

// const obj = {};
// const arr = reactive([obj]);
// // 1. 访问arr[0]时会创建一个响应式对象
// // 2. includes内部也会通过索引访问到arr[0]此时又会创建一个obj的代理对象
// console.log(arr.includes(arr[0]));
// console.log(arr.includes(obj));
// console.log(arr.indexOf(obj));
// console.log(arr.lastIndexOf(obj));

// const arr1 = reactive([]);

// effect(() => {
//   console.log('执行');
//   arr1.push(111);
// });
// effect(() => {
//   console.log('执行');
//   arr1.push(222);
// });

// const obj = {
//   one: {
//     two: {
//       three: 1,
//     },
//   },
// };
// const p = shallowReactive(obj);


// effect(() => {
//   console.log(p.one.two);
// })

// p.one.two = 2