/** @format */

// 实现自定义渲染器
const { effect, ref, reactive } = VueReactivity;

function createRenderer(options) {
  const { createElement, setElementText, insert } = options;
  function mountElement(vnode, container) {
    const el = createElement(vnode.type);
    if (typeof vnode.children === 'string') {
      setElementText(el, vnode.children);
    }
    insert(el, container);
  }
  function patch(n1, n2, container) {
    // TODO 在这里编写渲染逻辑
    // 如果n1不存在 意味着挂载
    if (!n1) {
      mountElement(n2, container);
    } else {
      console.log('走到这');
      // 如果n1 存在 则意味着打补丁
    }
  }
  function renderer(vnode, container) {
    if (vnode) {
      patch(container._vnode, vnode, container);
    } else {
      if (container._vnode) {
        container.innerHTML = '';
      }
    }

    container._vnode = vnode;
  }
  return { renderer };
}
const { renderer } = createRenderer({
  createElement(tag) {
    return document.createElement(tag);
  },
  setElementText(el, text) {
    el.textContent = text;
  },
  insert(el, parent, anchor = null) {
    parent.insertBefore(el, anchor);
  },
});

const vnode = ref({
  type: 'h1',
  children: 'hello',
});
effect(() => {
  renderer(vnode.value, document.getElementById('app'));
});

setTimeout(() => {
  vnode.value = {
    type: 'h1',
    children: 'helloworld',
  };
}, 2000);
