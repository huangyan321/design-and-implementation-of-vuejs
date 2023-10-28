/** @format */

// 挂载与更新
const { effect, ref, reactive } = VueReactivity;

function createRenderer(options) {
  const { createElement, setElementText, insert, patchProps } = options;

  function shouldSetAsProps(el, key, value) {
    if (key === 'form' && el.tagName === 'INPUT') return false;
    return key in el;
  }
  function mountElement(vnode, container) {
    const el = (vnode.el = createElement(vnode.type));
    if (vnode.props) {
      for (const key in vnode.props) {
        const value = vnode.props[key];
        patchProps(el, key, null, value);
      }
    }
    if (typeof vnode.children === 'string') {
      setElementText(el, vnode.children);
    } else if (Array.isArray(vnode.children)) {
      vnode.children.forEach((child) => {
        // 将刚刚创建的子节点传给patch函数
        patch(null, child, el);
      });
    }
    insert(el, container);
  }
  function patch(n1, n2, container) {
    // TODO 在这里编写渲染逻辑
    if (n1 && n1.type !== n2.type) {
      unmount(n1);
      n1 = null;
    }
    const { type } = n2;
    if (typeof type === 'string') {
      // 如果n1不存在 意味着挂载
      if (!n1) {
        mountElement(n2, container);
      } else {
        // 如果n1 存在 则意味着打补丁
        console.log('打补丁');
      }
    } else if (typeof type === 'object') {
      console.log('处理组件');
    } else if (type === 'xxx') {
      console.log('处理其他类型');
    }
  }
  function unmount(vnode) {
    const el = vnode.el;
    const parent = el.parentNode;
    if (parent) parent.removeChild(el);
  }
  function renderer(vnode, container) {
    if (vnode) {
      patch(container._vnode, vnode, container);
    } else {
      if (container._vnode) {
        unmount(container._vnode);
      }
    }

    container._vnode = vnode;
  }
  return { renderer };
}
// 创建渲染器，可传入自定义操作api，提供跨平台能力
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
  patchProps(el, key, preValue, nextValue) {
    function shouldSetAsProps(el, key, value) {
      if (key === 'form' && el.tagName === 'INPUT') return false;
      return key in el;
    }
    // 在设置class的一系列方法里（setAttribute、className、classList）使用className性能最佳。
    // 可以对class的设置进行特殊处理
    if (/^on/.test(key)) {
      let invokers = el._vei || (el._vei = {});
      const name = key.slice(2).toLowerCase();
      let invoker = invokers[name];
      if (nextValue) {
        if (!invoker) {
          invoker = el._vei[name] = (e) => {
            if (Array.isArray(invoker.value)) {
              invoker.value.forEach((fn) => fn(e));
            } else {
              invoker.value(e);
            }
          };
          invoker.value = nextValue;
          el.addEventListener(name, invoker);
        } else {
          invoker.value = nextValue;
        }
      } else if (invoker) {
        el.removeEventListener(name, invoker);
      }
    } else if (key === 'class') {
      el.className = nextValue || '';
    } else if (shouldSetAsProps(el, key, nextValue)) {
      const type = typeof el[key];
      // 如果dom properties为字符串类型且props内的属性值为空 则自动置为true
      if (type === 'boolean' && nextValue === '') {
        el[key] = true;
      } else {
        el[key] = nextValue;
      }
    } else {
      el.setAttribute(key, vnode.props[key]);
    }
  },
});

const vnode = ref({
  type: 'h1',
  props: {
    id: 'kk',
    onClick: [
      () => {
        console.log('1点击了');
      },
      () => {
        console.log('2点击了');
      },
    ],
  },
  children: [
    {
      type: 'p',
      children: '你好我是p1',
    },
    {
      type: 'p',
      children: '你好我是p2',
    },
    {
      type: 'button',
      props: {
        disabled: '',
        // 可通过标准化class 处理多种数据结构并归一化为字符串
        class: 'foo bar',
      },
      children: '你好我是button',
    },
  ],
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
