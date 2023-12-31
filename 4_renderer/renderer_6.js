/** @format */

// 快速diff算法

const { effect, ref, reactive } = VueReactivity;
// 文本节点唯一标识
const Text = Symbol();
// 注释节点唯一标识
const Comment = Symbol();
// Fragment节点唯一标识
const Fragment = Symbol();
// 寻找一个数组中的最长递增子序列（取自vue3）
function getSequence(arr) {
  const p = arr.slice();
  const result = [0];
  let i, j, u, v, c;
  const len = arr.length;
  for (i = 0; i < len; i++) {
    const arrI = arr[i];
    if (arrI !== 0) {
      j = result[result.length - 1];
      if (arr[j] < arrI) {
        p[i] = j;
        result.push(i);
        continue;
      }
      u = 0;
      v = result.length - 1;
      while (u < v) {
        c = ((u + v) / 2) | 0;
        if (arr[result[c]] < arrI) {
          u = c + 1;
        } else {
          v = c;
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1];
        }
        result[u] = i;
      }
    }
  }
  u = result.length;
  v = result[u - 1];
  while (u-- > 0) {
    result[u] = v;
    v = p[v];
  }
  return result;
}
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
  function patchKeyedChildren(n1, n2, container) {
    const oldChildren = n1.children;
    const newChildren = n2.children;
    // 建立索引
    let j = 0;
    let oldVNode = oldChildren[j];
    let newVNode = newChildren[j];
    while (oldVNode.key === newVNode.key) {
      // 调用patch进行更新
      patch(oldVNode, newVNode, container);
      // 递增索引
      j++;
      oldVNode = oldChildren[j];
      newVNode = newChildren[j];
    }
    // 到这里 我们使用while循环找出了所有前置节点
    let oldEnd = oldChildren.length - 1;
    let newEnd = newChildren.length - 1;
    oldVNode = oldChildren[oldEnd];
    newVNode = newChildren[newEnd];
    while (oldVNode.key === newVNode.key) {
      // 调用patch进行更新
      patch(oldVNode, newVNode, container);
      // 递减索引
      oldEnd--;
      newEnd--;
      oldVNode = oldChildren[oldEnd];
      newVNode = newChildren[newEnd];
    }
    // 到这里处理完所有后置节点
    // 预处理完毕后，如果满足以下条件，则说明要新增节点
    if (j > oldEnd && j <= newEnd) {
      const anchorIndex = newEnd + 1;
      // 锚点元素
      const anchor =
        anchorIndex < newChildren.length ? newChildren[anchorIndex] : null;
      while (j <= newEnd) {
        patch(null, newChildren[j++], container, anchor);
      }
    } else if (j > newEnd && j <= oldEnd) {
      while (j <= oldEnd) {
        unmount(oldChildren[j++]);
      }
    } else {
      // 计算剩余需要被处理的节点
      const count = newEnd - j + 1;
      const source = new Array(count);
      source.fill(-1);
      const oldStart = j;
      const newStart = j;
      let moved = false;
      let pos = 0;
      // 性能优化，建立索引表
      const keyIndex = {};
      for (let i = newStart; i <= newEnd; i++) {
        keyIndex[newChildren[i].key] = i;
      }
      // 新增patched变量，代表已经更新过的节点数量
      let patched = 0;
      for (let i = oldStart; i <= oldEnd; i++) {
        oldVNode = oldChildren[i];
        // 如果更新过的节点数量小于需要更新的节点数量，则进行更新
        if (patched <= count) {
          // 找到新节点组中相同key对应的位置索引
          const k = keyIndex[oldVNode.key];
          if (typeof k !== 'undefined') {
            // 找到该旧节点在新节点组中key相同的节点
            newVNode = newChildren[k];
            patch(oldVNode, newVNode, container);
            patched++;
            source[k - newStart] = i;
            // 遍历旧节点时，新节点的索引是否呈现递增序列
            if (k < pos) {
              moved = true;
            } else {
              pos = k;
            }
          } else {
            // 没找到
            unmount(oldVNode);
          }
        } else {
          unmount(oldVNode);
        }
      }
      if (moved) {
        const seq = getSequence(source);
        let s = seq.length - 1;
        let i = count - 1;
        for (i; i >= 0; i--) {
          if (!~source[i]) {
            // source[i]为-1说明索引为i的节点是全新的节点，应该将其挂载
            // 这里加了newStart代表是newChidren中的真实索引
            const pos = i + newStart;
            const newVNode = newChildren[pos];
            const nextPos = pos + 1;
            const anchor =
              nextPos < newChildren.length ? newChildren[nextPos].el : null;
            patch(null, newVNode, container, anchor);
          } else if (i !== seq[s]) {
            // 需要移动
            // 获取真实索引
            const pos = i + newStart;
            const newVNode = newChildren[pos];
            const nextPos = i + 1;
            const anchor =
              nextPos < newChildren.length ? newChildren[nextPos].el : null;
            insert(newVNode.el, container, anchor);
          } else {
            // 否则不需要移动，只要将s指向下一个位置
            s--;
          }
        }
      }
    }
  }
  function patchChildren(n1, n2, container) {
    if (typeof n2.children === 'string') {
      if (Array.isArray(n1.children)) {
        n1.children.forEach((c) => unmount(c));
      }
      setElementText(container, n2.children);
    } else if (Array.isArray(n2.children)) {
      if (Array.isArray(n1.children)) {
        // 快速diff算法实现
        console.time('patch');
        patchKeyedChildren(n1, n2, container);
        console.timeEnd('patch');
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
      key: 1,
      children: '你好我是p1',
    },
    {
      type: 'p',
      key: 2,
      children: '你好我是p2',
    },
    {
      type: 'p',
      key: 3,
      children: '你好我是p3',
    },
    {
      type: 'p',
      key: 4,
      children: '你好我是p4',
    },
    {
      type: 'p',
      key: 5,
      children: '你好我是p5',
    },
    {
      type: 'p',
      key: 6,
      children: '你好我是p6',
    },
    {
      type: 'p',
      key: 7,
      children: '你好我是p7',
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
        key: 2,
        children: '你好我是p2',
      },
      {
        type: 'p',
        key: 4,
        children: '你好我是p4',
      },
      {
        type: 'p',
        key: 10,
        children: '你好我是p10',
      },
      {
        type: 'p',
        key: 9,
        children: '你好我是p9',
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
      {
        type: 'p',
        key: 5,
        children: '你好我是p5',
      },
      {
        type: 'p',
        key: 6,
        children: '你好我是p6',
      },
      {
        type: 'p',
        key: 7,
        children: '你好我是p7',
      },
      {
        type: 'p',
        key: 8,
        children: '你好我是p8',
      },
    ],
  };
}, 1000);
