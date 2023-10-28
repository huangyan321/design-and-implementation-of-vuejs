/** @format */

// 代理Object
/** @format */
const data = {
  foo: NaN,
  bar: 1,
};
console.log(data);
let temp1, temp2;
let activeEffect;
const ITERATE_KEY = Symbol();
const effectStack = [];
const TriggerType = {
  SET: 'SET',
  ADD: 'ADD',
  DELETE: 'DELETE',
};
const bucket = new WeakMap();
function track(target, key) {
  if (!activeEffect) return;
  let depsMap = bucket.get(target);
  if (!depsMap) bucket.set(target, (depsMap = new Map()));
  let deps = depsMap.get(key);
  if (!deps) depsMap.set(key, (deps = new Set()));
  deps.add(activeEffect);
  activeEffect.deps.push(deps);
}
function trigger(target, key, type) {
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  const effects = depsMap.get(key);
  const effectsToRun = new Set();

  // 取得与ITERATE_KEY相关联的函数
  effects &&
    effects.forEach((effect) => {
      if (effect !== activeEffect) {
        effectsToRun.add(effect);
      }
    });
  // 只有新增属性时才会触发ITERATE_KEY相关联函数执行
  if (type === TriggerType.ADD || type === TriggerType.DELETE) {
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
const obj = new Proxy(data, {
  get(target, key, receiver) {
    track(target, key);
    // 这里的receiver 相当于this,将target的this绑定在了代理的对象obj上,这样在原始对象中访问的this就是代理对象,就能够进行依赖收集
    return Reflect.get(target, key, receiver);
  },
  set(target, key, newValue, receiver) {
    const oldValue = target[key];
    const type = Object.prototype.hasOwnProperty.call(target, key)
      ? TriggerType.SET
      : TriggerType.ADD;
    const res = Reflect.set(target, key, newValue, receiver);
    // 增加判断NaN的条件
    if (
      oldValue !== newValue &&
      (oldValue === oldValue || newValue === newValue)
    ) {
      trigger(target, key, type);
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
    track(target, ITERATE_KEY);
    return Reflect.ownKeys(target);
  },
  deleteProperty(target, key) {
    const hadKey = Object.prototype.hasOwnProperty.call(target, key);
    const res = Reflect.deleteProperty(target, key);
    if (res && hadKey) {
      trigger(target, key, 'DELETE');
    }
    return res;
  },
});
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
effect(() => {
  console.log('obj.foo 运行');
  console.log(obj.foo);
});
effect(() => {
  console.log('foo in obj 运行');
  'foo' in obj;
});
effect(() => {
  console.log('for (const i in obj) 重新运行');
  for (const i in obj) {
  }
});
// 响应式正常触发
obj.foo = NaN;
// delete obj.bar;
