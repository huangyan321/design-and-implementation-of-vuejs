/** @format */

// 简单diff算法

const { effect, ref, reactive } = VueReactivity;
// 文本节点唯一标识
const Text = Symbol();
// 注释节点唯一标识
const Comment = Symbol();
// Fragment节点唯一标识
const Fragment = Symbol();
function createRenderer(options) {
  const {
    createElement,
    setElementText,
    insert,
    patchProps,
    createText,
    setText,
    createComment,
  } = options;

  function shouldSetAsProps(el, key, value) {
    if (key === 'form' && el.tagName === 'INPUT') return false;
    return key in el;
  }
  function mountElement(vnode, container, anchor) {
    const el = (vnode.el = createElement(vnode.type));
    if (typeof vnode.children === 'string') {
      setElementText(el, vnode.children);
    } else if (Array.isArray(vnode.children)) {
      vnode.children.forEach((child) => {
        // 将刚刚创建的子节点传给patch函数
        patch(null, child, el);
      });
    }
    if (vnode.props) {
      for (const key in vnode.props) {
        const value = vnode.props[key];
        patchProps(el, key, null, value);
      }
    }
    insert(el, container, anchor);
  }
  function patchChildren(n1, n2, container) {
    if (typeof n2.children === 'string') {
      if (Array.isArray(n1.children)) {
        n1.children.forEach((c) => unmount(c));
      }
      setElementText(container, n2.children);
    } else if (Array.isArray(n2.children)) {
      if (Array.isArray(n1.children)) {
        // 简单diff算法实现
        const oldChildren = n1.children;
        const newChildren = n2.children;
        // 定义初始最大索引为0
        // 在一组旧节点寻找相同key的过程中记录最大索引值lastIndex
        // ，当后续匹配到的旧节点比lastIndex更小时，说明该节点需要移动
        let lastIndex = 0;
        for (let i = 0; i < newChildren.length; i++) {
          const newVNode = newChildren[i];
          let j = 0;
          let find = false;
          for (j; j < oldChildren.length; j++) {
            const oldVNode = oldChildren[j];
            if (newVNode.key === oldVNode.key) {
              // 在旧节点组中找到相同key的节点
              find = true;
              patch(oldVNode, newVNode, container);
              if (j < lastIndex) {
                const preVNode = newChildren[i - 1];
                if (preVNode) {
                  const anchor = preVNode.el.nextSibling;
                  insert(newVNode.el, container, anchor);
                }
              } else {
                lastIndex = j;
              }
              break;
            }
          }
          // 如果找遍了还是没找到匹配的，说明该newVNode是新增节点
          if (!find) {
            const preVNode = newChildren[i - 1];
            let anchor;
            if (preVNode) {
              anchor = preVNode.el.nextSibling;
            } else {
              anchor = container.firstChild;
            }
            patch(null, newVNode, container, anchor);
          }
        }

        // 更新完后，遍历旧节点组，移除在新节点组里找不到的节点
        for (let i = 0; i < oldChildren.length; i++) {
          const oldVNode = oldChildren[i];
          const has = newChildren.find((vnode) => vnode.key === oldVNode.key);
          if (!has) {
            unmount(oldVNode);
          }
        }
      } else {
        setElementText(container, '');
        n2.children.forEach((c) => patch(null, c, container));
      }
    } else {
      // 走到这里 说明新子节点不存在，把旧节点卸载即可
      if (Array.isArray(n1.children)) {
        n1.children.forEach((c) => unmount(c));
      } else if (typeof n1.children === 'string') {
        setElementText(container, '');
      }
    }
  }
  function patchElement(n1, n2) {
    const el = (n2.el = n1.el);
    const oldProps = n1.props;
    const newProps = n2.props;
    for (const key in newProps) {
      if (newProps[key] !== oldProps[key]) {
        patchProps(el, key, oldProps[key], newProps[key]);
      }
      for (const key in oldProps) {
        if (!(key in newProps)) {
          patchProps(el, key, oldProps[key], null);
        }
      }
    }
    patchChildren(n1, n2, el);
  }
  function patch(n1, n2, container, anchor) {
    // TODO 在这里编写渲染逻辑
    if (n1 && n1.type !== n2.type) {
      unmount(n1);
      n1 = null;
    }
    const { type } = n2;
    if (typeof type === 'string') {
      // 如果n1不存在 意味着挂载
      if (!n1) {
        mountElement(n2, container, anchor);
      } else {
        // 如果n1 存在 则意味着打补丁
        patchElement(n1, n2, container);
      }
    } else if (type === Text) {
      // 处理文本节点类型
      if (!n1) {
        const el = (n2.el = createText(n2.children));
        insert(el, container);
      } else {
        const el = (n2.el = n1.el);
        if (n2.children !== n1.children) {
          setText(el, n2.children);
        }
      }
    } else if (type === Comment) {
      // 处理文本节点类型
      if (!n1) {
        const el = (n2.el = createComment(n2.children));
        insert(el, container);
      } else {
        const el = (n2.el = n1.el);
        if (n2.children !== n1.children) {
          setComment(el, n2.children);
        }
      }
    } else if (type === Fragment) {
      // 处理文本节点类型
      if (!n1) {
        n2.children.forEach((c) => patch(null, c, container));
      } else {
        patchChildren(n1, n2, container);
      }
    } else if (typeof type === 'object') {
      console.log('处理组件');
    } else if (type === 'xxx') {
      console.log('处理其他类型');
    }
  }
  function unmount(vnode) {
    if (vnode.type === Fragment) {
      vnode.children.forEach((c) => unmount(c));
    }
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

    if (/^on/.test(key)) {
      let invokers = el._vei || (el._vei = {});
      const name = key.slice(2).toLowerCase();
      let invoker = invokers[name];
      if (nextValue) {
        if (!invoker) {
          invoker = el._vei[name] = (e) => {
            // 修复事件冒泡问题，屏蔽所有绑定事件晚于事件触发时间的事件执行
            if (e.timestamp < invoker.attached) return;
            if (Array.isArray(invoker.value)) {
              invoker.value.forEach((fn) => fn(e));
            } else {
              invoker.value(e);
            }
          };
          invoker.value = nextValue;
          el.addEventListener(name, invoker);
          invoker.attached = performance.now();
        } else {
          invoker.value = nextValue;
        }
      } else if (invoker) {
        el.removeEventListener(name, invoker);
      }
    } else if (key === 'class') {
      // 在设置class的一系列方法里（setAttribute、className、classList）使用className性能最佳。
      // 可以对class的设置进行特殊处理
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
  createText(text) {
    return document.createTextNode(text);
  },
  setText(el, text) {
    el.nodeValue = text;
  },
  createComment(text) {
    return document.createComment(text);
  },
  setComment(el, text) {
    el.nodeValue = text;
  },
});

const vnode = ref({
  type: 'h1',
  props: {
    id: 'kk',
  },
  key: 1,
  children: [
    {
      type: 'p',
      key: 2,
      children: '你好我是p2',
    },
    {
      type: 'p',
      key: 1,
      children: '你好我是p1',
    },
    {
      type: 'p',
      key: 3,
      children: '你好我是p3',
    },
  ],
});
effect(() => {
  renderer(vnode.value, document.getElementById('app'));
});

setTimeout(() => {
  vnode.value = {
    type: 'h1',
    props: {
      id: 'kk',
    },
    key: 1,
    children: [
      {
        type: 'p',
        key: 1,
        children: '你好我是p1',
      },
      {
        type: 'p',
        key: 2,
        children: '你好我是p2',
      },
    ],
  };
}, 1000);
