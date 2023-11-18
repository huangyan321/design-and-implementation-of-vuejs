/** @format */

const template = `<div><p>Vue</p><p>Template</p></div>`;

const ast = parse(template);
const jsAst = transform(ast).jsNode;
const code = generate(jsAst);

console.log(code);

function parse(template) {
  const State = {
    initial: 1, // 初始状态
    tagOpen: 2, // 标签开始状态
    tagName: 3, // 标签名称状态
    text: 4, // 文本状态
    tagEnd: 5, // 结束标签状态
    tagEndName: 6, // 结束标签名称状态
  };
  function isAlpha(char) {
    return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
  }
  function tokenize(str) {
    // 状态机初始状态
    let currentState = State.initial;
    const chars = []; // 用于生成缓存字符
    const tokens = []; // 用于存放生成的token

    while (str) {
      const char = str[0];
      switch (currentState) {
        case State.initial:
          if (char === '<') {
            // 状态机切换到标签开始状态
            currentState = State.tagOpen;
            // 消费字符
            str = str.slice(1);
          } else if (isAlpha(char)) {
            // 状态机切换到文本状态
            currentState = State.text;
            chars.push(char);
            // 消费字符
            str = str.slice(1);
          }
          break;
        case State.tagOpen:
          if (isAlpha(char)) {
            currentState = State.tagName;
            chars.push(char);
            str = str.slice(1);
          } else if (char === '/') {
            currentState = State.tagEnd;
            str = str.slice(1);
          }
          break;
        case State.tagName:
          if (isAlpha(char)) {
            chars.push(char);
            str = str.slice(1);
          } else if (char === '>') {
            currentState = State.initial;
            tokens.push({
              type: 'tag',
              name: chars.join(''),
            });
            chars.length = 0;
            str = str.slice(1);
          }
          break;
        case State.text:
          if (isAlpha(char)) {
            currentState = State.text;
            chars.push(char);
            str = str.slice(1);
          } else if (char === '<') {
            currentState = State.tagOpen;
            // 此时文本已经结束，生成文本token
            tokens.push({
              type: 'text',
              content: chars.join(''),
            });
            chars.length = 0;
            // 消费
            str = str.slice(1);
          }
          break;
        case State.tagEnd:
          // 切换到标签结束名称状态
          if (isAlpha(char)) {
            currentState = State.tagEndName;
            chars.push(char);
            str = str.slice(1);
          }
          break;
        case State.tagEndName:
          if (isAlpha(char)) {
            chars.push(char);
            str = str.slice(1);
          } else if (char === '>') {
            currentState = State.initial;
            tokens.push({
              type: 'tagEnd',
              name: chars.join(''),
            });
            chars.length = 0;
            str = str.slice(1);
          }
          break;
      }
    }
    return tokens;
  }
  function genElementNode(tagName, children) {
    return {
      type: 'Element',
      tag: tagName,
      children,
    };
  }
  function genTextNode(content) {
    return {
      type: 'Text',
      content,
    };
  }
  const tokens = tokenize(template);
  console.log(tokens);
  const root = {
    type: 'Root',
    children: [],
  };
  const elementStack = [root];
  while (tokens.length) {
    const parent = elementStack[elementStack.length - 1];
    const t = tokens[0];
    switch (t.type) {
      case 'tag':
        const elementNode = genElementNode(t.name, []);
        parent.children.push(elementNode);
        elementStack.push(elementNode);
        break;
      case 'text':
        const textNode = genTextNode(t.content);
        parent.children.push(textNode);
        break;
      case 'tagEnd':
        elementStack.pop();
        break;
    }
    tokens.shift();
  }
  return root;
}
function transform(templateAST) {
  function dump(node, indent = 0) {
    const type = node.type;
    const desc =
      type === 'Root' ? '' : type === 'Element' ? node.tag : node.content;
    console.log(`${'-'.repeat(indent)}${type}:${desc}`);
    if (node.children) {
      node.children.forEach((child) => {
        dump(child, indent + 2);
      });
    }
  }
  // 深度遍历节点
  function traverseNode(ast, context) {
    const currentNode = (context.currentNode = ast);
    // 增加退出阶段的回调函数数组
    const exitFns = [];
    const transforms = context.nodeTransforms;
    for (let i = 0; i < transforms.length; i++) {
      const transform = transforms[i];
      const onExit = transform(currentNode, context);
      if (onExit) {
        exitFns.push(onExit);
      }
      if (!context.currentNode) return;
    }
    const children = currentNode.children;
    if (children) {
      for (let i = 0; i < children.length; i++) {
        context.parent = currentNode;
        context.childIndex = i;
        const child = children[i];
        traverseNode(child, context);
      }
    }
    let i = exitFns.length;
    while (i--) {
      exitFns[i]();
    }
  }
  function createStringLiteral(value) {
    return {
      type: 'StringLiteral',
      value,
    };
  }
  function createIdentifier(name) {
    return {
      type: 'Identifier',
      name,
    };
  }
  function createArrayExpression(elements) {
    return {
      type: 'ArrayExpression',
      elements,
    };
  }
  function createCallExpression(callee, args) {
    return {
      type: 'CallExpression',
      callee,
      arguments: args,
    };
  }
  // 转换文本节点
  function transformText(node, context) {
    if (node.type !== 'Text') return;
    node.jsNode = createStringLiteral(node.content);
  }
  function transformElement(node, context) {
    // 将转换代码编写到退出阶段中可保证该标签节点下的所有子节点都被处理完毕
    return () => {
      if (node.type !== 'Element') return;
      const callExp = createCallExpression('h', [
        createStringLiteral(node.tag),
      ]);
      node.children.length === 1
        ? callExp.arguments.push(node.children[0].jsNode)
        : callExp.arguments.push(
            createArrayExpression(node.children.map((c) => c.jsNode))
          );
      node.jsNode = callExp;
    };
  }
  function transformRoot(node) {
    return () => {
      if (node.type !== 'Root') return;
      const vnodeAst = node.children[0].jsNode;
      node.jsNode = {
        type: 'FunctionDecl',
        id: {
          type: 'Identifier',
          name: 'render',
        },
        params: [],
        body: [
          {
            type: 'ReturnStatement',
            return: vnodeAst,
          },
        ],
      };
    };
  }
  const context = {
    // 增加 currentNode 用来存储当前正在转换的节点
    currentNode: null,
    // 增加 childIndex 用来存储当前节点在父节点的children中的索引
    childIndex: 0,
    // 增加 parent 用来存储当前节点的父节点
    parent: null,
    replaceNode(node) {
      if (this.parent) {
        this.parent.children[this.childIndex] = node;
      }
      this.currentNode = node;
    },
    removeNode(node) {
      if (this.parent) {
        this.parent.children.splice(this.childIndex, 1);
      }
      this.currentNode = null;
    },
    nodeTransforms: [transformRoot, transformElement, transformText],
  };
  // 深度优先遍历节点
  traverseNode(templateAST, context);
  dump(templateAST);
  return templateAST;
}
function generate(jsAST) {
  const context = {
    code: '',
    currentIndent: 0,
    newLine() {
      context.code += '\n' + `  `.repeat(context.currentIndent);
    },
    indent() {
      context.currentIndent++;
      context.newLine();
    },
    deIdent() {
      context.currentIndent--;
      context.newLine();
    },
    push(code) {
      context.code += code;
    },
  };
  function genFunctionDecl(node, context) {
    const { push, indent, deIdent } = context;
    push(`function ${node.id.name}`);
    push(`(`);
    genNodeList(node.params, context);
    push(`)`);
    push(`{`);
    // 缩进
    indent();
    node.body.forEach((node) => genNode(node, context));
    // 取消缩进
    deIdent();
    push(`}`);
  }
  function genReturnStatement(node, context) {
    const { push } = context;
    push(`return `);
    genNode(node.return, context);
  }
  function genStringLiteral(node, context) {
    const { push } = context;
    push(`"${node.value}"`);
  }
  function genCallExpression(node, context) {
    const { push } = context;
    const { callee, arguments: args } = node;
    push(`${callee}(`);
    genNodeList(args, context);
    push(`)`);
  }
  function genArrayExpression(node, context) {
    const { push } = context;
    push(`[`);
    genNodeList(node.elements, context);
    push(`]`);
  }
  function genNodeList(nodes, context) {
    const { push } = context;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      genNode(node, context);
      if (i < nodes.length - 1) {
        push(',');
      }
    }
  }
  function genNode(node, context) {
    switch (node.type) {
      case 'FunctionDecl':
        genFunctionDecl(node, context);
        break;
      case 'ReturnStatement':
        genReturnStatement(node, context);
        break;
      case 'CallExpression':
        genCallExpression(node, context);
        break;
      case 'StringLiteral':
        genStringLiteral(node, context);
        break;
      case 'ArrayExpression':
        genArrayExpression(node, context);
        break;
    }
  }
  genNode(jsAST, context);
  return context.code;
}
