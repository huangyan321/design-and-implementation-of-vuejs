/** @format */

// 匿名函数响应式处理
const data = { text: 'hello world' };

let activeEffect;

const bucket = new WeakMap();

const obj = new Proxy(data, {
  get(target, key) {
    if (!activeEffect) return target[key];
    let depsMap = bucket.get(target);
    if (!depsMap) bucket.set(target, (depsMap = new Map()));
    let deps = depsMap.get(key);
    if (!deps) depsMap.set(key, (deps = new Set()));
    deps.add(activeEffect);
    return target[key];
  },
  set(target, key, newValue) {
    target[key] = newValue;
    const depsMap = bucket.get(target);
    if (!depsMap) return;
    const effects = depsMap.get(key);
    effects && effects.forEach((effect) => effect());
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
