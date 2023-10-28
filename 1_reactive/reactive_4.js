/** @format */

// 分支切换与cleanup
/** @format */
const data = { text: 'hello world', ok: true };

let activeEffect;

const bucket = new WeakMap();
function track(target, key) {
  if (!activeEffect) return target[key];
  let depsMap = bucket.get(target);
  if (!depsMap) bucket.set(target, (depsMap = new Map()));
  let deps = depsMap.get(key);
  if (!deps) depsMap.set(key, (deps = new Set()));
  deps.add(activeEffect);
  // 将依赖集合关联到副作用函数的deps数组中
  activeEffect.deps.push(deps);
}
function trigger(target, key) {
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  const effects = depsMap.get(key);
  // 此写法将导致无限循环，问题原因： 在遍历effects时，会同时进行依赖清空和收集操作，Set语法明确规定，这样操作会导致无限循环
  // effects && effects.forEach((effect) => effect());

  // 使用嵌套Set 避免无限循环
  const effectsToRun = new Set(effects);
  effectsToRun.forEach((effect) => effect());
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
  console.log(deps);
  for (let i = 0; i < deps.length; i++) {
    const deps = effectFn.deps[i];
    deps.delete(effectFn);
  }
  deps.length = 0;
}
function effect(fn) {
  const effectFn = () => {
    // 执行副作用函数前 先调用cleanup将依赖集合中的所有改副作用函数清空，防止依赖残留
    cleanup(effectFn);
    activeEffect = effectFn;
    fn();
  };
  // effectFn.deps 用于记录 含有该副作用函数的依赖集合
  effectFn.deps = [];
  effectFn();
}

effect(() => {
  console.log('effect运行');
  document.body.innerText = obj.ok ? obj.text : 'not ok';
});
setTimeout(() => {
  obj.ok = false;
  console.log(bucket);
}, 2000);

// 缺陷

// setTimeout(() => {
//   obj.noExist = 'hello vue3';
// }, 2000);
