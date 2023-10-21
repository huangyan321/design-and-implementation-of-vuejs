/** @format */

// computed实现
/** @format */
const data = { foo: 1, bar: 2 };
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
  get(target, key) {
    track(target, key);
    return target[key];
  },
  set(target, key, newValue) {
    target[key] = newValue;
    trigger(target, key);
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
// 实现一个任务队列
const jobQueue = new Set();

let isFlushing = false;
const p = Promise.resolve();
function flushJob() {
  if (isFlushing) return;
  isFlushing = true;

  p.then(() => {
    jobQueue.forEach((job) => job());
  }).finally(() => {
    isFlushing = false;
  });
}

// effect(
//   function () {
//     console.log(obj.foo);
//   },
//   {
//     // 支持调度器选项
//     scheduler: (fn) => {
//       jobQueue.add(fn);
//       // setTimeout(fn);
//       flushJob();
//     },
//   }
// );

function computed(getter) {
  let dirty = true,
    storeValue;
  const effectFn = effect(getter, {
    scheduler(fn) {
      // 执行副作用函数
      dirty = true;
      trigger(obj, 'value');
    },
    lazy: true,
  });

  const obj = {
    get value() {
      if (dirty) {
        storeValue = effectFn();
        dirty = false;
      }
      track(obj, 'value');
      return storeValue;
    },
  };
  return obj;
}

const sum = computed(() => {
  return obj.foo + obj.bar;
});
console.log(sum.value);
console.log(sum.value);
console.log(sum.value);
console.log(sum.value);
console.log(sum.value);
obj.foo = 10;
console.log(sum.value);
const sum1 = computed(() => {
  return sum.value * 10;
});
console.log(sum1.value);
obj.foo = 15;
console.log(sum.value);
console.log(sum1.value);
console.log(bucket);
