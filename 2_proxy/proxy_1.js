/** @format */

// 使用Reflect避免某些情况无法触发响应式的问题
/** @format */
const data = {
  foo: 1,
  get bar() {
    return this.foo;
  },
};
console.log(data);
let temp1, temp2;
let activeEffect;
const effectStack = [];

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
function trigger(target, key) {
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  const effects = depsMap.get(key);
  const effectsToRun = new Set();
  effects.forEach((effect) => {
    if (effect !== activeEffect) {
      effectsToRun.add(effect);
    }
  });
  effectsToRun.forEach((effect) => {
    // 如果存在调度器，则使用调度器执行该副作用函数
    if (effect.options && effect.options.scheduler) {
      effect.options.scheduler(effect);
    } else {
      // 不存在则默认立即执行
      effect();
    }
  });
}
const obj = new Proxy(data, {
  get(target, key, receiver) {
    track(target, key);
    // 这里的receiver 相当于this,将target的this绑定在了代理的对象obj上,这样在原始对象中访问的this就是代理对象,就能够进行依赖收集
    return Reflect.get(target, key, receiver);
  },
  set(target, key, newValue) {
    if (target[key] !== newValue) {
      target[key] = newValue;
      trigger(target, key);
    }
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
  console.log(obj.bar);
});
// 响应式正常触发
obj.foo = 2;
