/** @format */

// 基础响应式
const data = { text: 'hello world' };

function effect() {
  document.body.innerText = obj.text;
}

const bucket = new Set();

const obj = new Proxy(data, {
  get(target, value) {
    bucket.add(effect);
    return target[value];
  },
  set(target, key, newValue) {
    target[key] = newValue;
    bucket.forEach((effect) => effect());
    return true;
  },
});

effect();

setTimeout(() => {
  obj.text = 'hello vue3';
}, 2000);
