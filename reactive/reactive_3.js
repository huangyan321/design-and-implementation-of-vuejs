/** @format */

// 代码封装
const data = { text: 'hello world' };

let activeEffect;

const bucket = new WeakMap();
function track(target, key) {
  if (!activeEffect) return target[key];
  let depsMap = bucket.get(target);
  if (!depsMap) bucket.set(target, (depsMap = new Map()));
  let deps = depsMap.get(key);
  if (!deps) depsMap.set(key, (deps = new Set()));
  deps.add(activeEffect);
}
function trigger(target, key) {
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  const effects = depsMap.get(key);
  effects && effects.forEach((effect) => effect());
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

function effect(fn) {
  activeEffect = fn;
  fn();
}

effect(() => {
  console.log('effect运行');
  document.body.innerText = obj.text;
});
console.log(bucket);
setTimeout(() => {
  obj.text = 'hello vue3';
}, 2000);

// 缺陷

// setTimeout(() => {
//   obj.noExist = 'hello vue3';
// }, 2000);
