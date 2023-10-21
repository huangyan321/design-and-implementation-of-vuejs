/** @format */

// watch实现
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

function traverse(value, seen = new Set()) {
  // 如果时原始值或已经观测过的值,就什么都不做
  if (typeof value !== 'object' || value === null || seen.has(value)) return;
  seen.add(value);
  for (const k in value) {
    traverse(value[k], seen);
  }
}

function watch(source, cb, options = {}) {
  let getter, newValue, oldValue, cleanup;
  if (typeof source === 'function') {
    getter = source;
  } else {
    getter = () => traverse(source);
  }
  const onInvalidate = (fn) => {
    cleanup = fn;
  };
  const job = () => {
    newValue = effectFn();
    // 为防止资源竞争,每次回调执行前先过期掉上次的回调
    if (cleanup) {
      cleanup();
    }
    cb(newValue, oldValue, onInvalidate);
    oldValue = newValue;
  };
  const effectFn = effect(() => getter(), {
    lazy: true,
    scheduler() {
      if (options.flush === 'post') {
        Promise.resolve().then(job);
      } else {
        job();
      }
    },
  });
  if (options.immediate) {
    job();
  } else {
    oldValue = effectFn();
  }
}
// 传入响应式数据
watch(obj, () => {
  console.log('重新运行');
});
// 传入getter函数
watch(
  () => obj.foo,
  (n, o) => {
    console.log('传入getter函数的watcher运行');
    console.log('新值', n);
    console.log('旧值', o);
  },
  {
    flush: 'post',
  }
);
obj.foo++;
obj.foo++;
obj.foo++;
obj.foo++;
