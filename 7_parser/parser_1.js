/** @format */

const TextModes = {
  DATA: 'DATA',
  RCDATA: 'RCDATA',
  RAWTEXT: 'RAWTEXT',
  CDATA: 'CDATA',
};
const template = `<div><p>template</p></div>`;
const res = parse(template);
function parse(str) {
  const context = {
    source: str,
    mode: TextModes.DATA,
    // 消费指定数量的字符
    advanceBy(num) {
      context.source = context.source.slice(num);
    },
    // 消费空格 如<div    >
    advanceSpaces() {
      const match = /^[\t\r\n\f ]+/.exec(context.source);
      if (match) {
        context.advanceBy(match[0].length);
      }
    },
  };
  function isEnd(context, ancestors) {
    if (!context.source) return true;
    const parent = ancestors[ancestors.length - 1];
    for (let i = ancestors.length - 1; i >= 0; --i) {
      const parent = ancestors[i];
      // 只要栈中存在与当前标签匹配的节点，就停止状态机
      if (parent && context.source.startsWith(`</${parent.tag}>`)) {
        return true;
      }
    }
  }
  function parseTag(context, type = 'start') {
    const { advanceBy, advanceSpaces } = context;
    console.log(/^<([a-z][^\t\r\n\f />]*)/i);
    const match =
      type === 'start'
        ? /^<([a-z][^\t\r\n\f />]*)/i.exec(context.source)
        : /^<\/([a-z][^\t\r\n\f />]*)/i.exec(context.source);
    const tag = match[1];
    advanceBy(match[0].length);
    advanceSpaces();
    const isSelfClosing = context.source.startsWith('/>');
    advanceBy(isSelfClosing ? 2 : 1);
    return {
      type: 'Element',
      tag,
      props: [],
      children: [],
      isSelfClosing,
    };
  }
  function parseElement(context, ancestors) {
    debugger
    // 解析开始标签
    const element = parseTag(context);
    if (element.isSelfClosing) return element;
    if (element.tag === 'textarea' || element.tag === 'title') {
      context.mode = TextModes.RCDATA;
    } else if (/style|xmp|iframe|noembed|noframes|noscript/.test(element.tag)) {
      context.mode = TextModes.RAWTEXT;
    } else {
      context.mode = TextModes.DATA;
    }
    ancestors.push(element);
    element.children = parseChildren(context, ancestors);
    ancestors.pop();
    if (context.source.startsWith(`</${element.tag}>`)) {
      parseEndTag(context, 'end');
    } else {
      console.error(`${element.tag}缺少自闭合标签`);
    }
    return element;
  }
  function parseChildren(context, ancestors) {
    const nodes = [];
    const { source, mode } = context;
    while (!isEnd(context, ancestors)) {
      let node;
      // 只有DATA和RCDATA才会支持插值的解析
      if (mode === TextModes.DATA || mode === TextModes.RCDATA) {
        if (mode === TextModes.DATA && source[0] === '<') {
          if (source[1] === '!') {
            // 判断是注释节点
            if (source.startsWith('<!--')) {
              node = parseComment(context);
            } else if (source.startsWith('<![CDATA[')) {
              // 判断是CDATA节点
              node = parseCDATA(context);
            }
          } else if (source[1] === '/') {
            // 这里需要抛出错误
            console.error('无效的结束标签');
          } else if (/[a-z]/i.test(source[1])) {
            // 判断是标签节点
            node = parseElement(context, ancestors);
          }
        } else if (source.startsWith('{{')) {
          // 判断是插值节点
          node = parseInterpolation(context);
        }
      }
      if (!node) {
        // TODO 解析文本
        node = parseText(context);
      }
      nodes.push(node);

      return nodes;
    }
  }
  const nodes = parseChildren(context, []);
  return {
    type: 'Root',
    children: nodes,
  };
}
