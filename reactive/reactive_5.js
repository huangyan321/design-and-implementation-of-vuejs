/** @format */

// 嵌套effect与effect栈
/** @format */
const data = { foo: true, bar: true };
let temp1, temp2;
let activeEffect;
// 新增effectStack 避免嵌套effect时 activeEffect 记录有误
const effectStack = [];

const bucket = new WeakMap();
function track(target, key) {
  if (!activeEffect) return target[key];
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
    cleanup(effectFn);
    activeEffect = effectFn;
    effectStack.push(effectFn);
    fn();
    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];
  };
  effectFn.deps = [];
  effectFn();
}
// 使用嵌套effect
effect(function effect1() {
  console.log('effect1运行');
  effect(function effect2() {
    console.log('effect2运行');
    temp1 = obj.foo;
  });
  temp2 = obj.bar;
});
setTimeout(() => {
  obj.foo = false;
}, 2000);
setTimeout(() => {
  obj.bar = false;
}, 3000);
