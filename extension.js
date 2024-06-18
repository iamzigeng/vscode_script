const vscode = require('vscode');
const fs = require('fs');
const luaParser = require('luaparse');
const defaultStr = '该语言id不存在';
let strValue = defaultStr;
let id;
let destWord = '';
let destPath = '';
// const regex = /(?<=')(\w+)(?=')/;
// const regex = /(?:^'|")?(\w+)(?:'|")?$/;
// const regex = /["'](\w+)["']/;

function convStr(str) {
	let result = str.replace(/"/g, '');
	result = result.replace(/'/g, '');
	return result
}

function tryFindLanguageStr(node) {
	switch (node.type) {
		case 'LocalStatement':
			if (node.init) {
				node.init.forEach(tryFindLanguageStr);
			}
			break;
		case 'Chunk':
			if (node.body) {
				node.body.forEach(tryFindLanguageStr);
			}
			break;
		case 'TableConstructorExpression':
			if (node.fields) {
				for (let index = 0; index < node.fields.length; index++) {
					const element = node.fields[index];
					tryFindLanguageStr(element);
					if (strValue != defaultStr) {
						// console.log("---strValue", strValue)
						break;
					}
				}
			}
			break;
		case 'TableKeyString':
			if (node.value && node.value.fields) {
				node.value.fields.forEach(tryFindLanguageStr);
			}
			break;
		case 'TableKey':
			if (node.key && node.key.type == 'NumericLiteral' && node.key.value == id) {
				for (let index = 0; index < node.value.fields.length; index++) {
					const element = node.value.fields[index];
					if (element.key.name == 'Txt') {
						strValue = element.value.raw;
						// console.log(strValue);
						// console.log(node);
						break;
					}
				}
			}
			break;
		default:
			break;
	}
}

function tryFindFilePath(node) {
	switch (node.type) {
		case 'LocalStatement':
			if (node.init && (node.variables[0].name === 'CONFIG' || node.variables[0].name === 'syncStaticList')) {
				node.init.forEach(tryFindFilePath);
			}
			break;
		case 'Chunk':
			if (node.body) {
				node.body.forEach(tryFindFilePath);
			}
			break;
		case 'TableConstructorExpression':
			if (node.fields) {
				for (let index = 0; index < node.fields.length; index++) {
					const element = node.fields[index];
					tryFindFilePath(element);
					if (destPath != '') {
						// console.log("---destPath", destPath)
						break;
					}
				}
			}
			break;
		case 'TableKeyString':
			if (node.value && node.value.fields) {
				node.value.fields.forEach(tryFindFilePath);
			}
			break;
		case 'TableKey':
			// for conf.lua
			if (node.key && node.key.type === 'StringLiteral') {
				let result = convStr(node.key.raw);
				// console.log(result === destWord);
				if (result === destWord) {
					for (let index = 0; index < node.value.fields.length; index++) {
						const element = node.value.fields[index];
						if (element.key.name === 'moduleP') {
							destPath = element.value.raw;
							// console.log(destPath);
							// console.log(node);
							break;
						}
					}
				}
			}
			break;
		case 'TableValue':
			// for global.lua
			if (node.value && node.value.type === 'TableConstructorExpression') {
				let fields = node.value.fields;
				if (fields[0]) {
					let result = convStr(fields[0].value.raw);
					// console.log(result === destWord);
					if (result === destWord) {
						destPath = fields[1].value.raw;
						// console.log(destPath);
					}
				}
			}
			break;
		default:
			break;
	}
}

function readLuaFiles() {
	const filePath = `${vscode.workspace.rootPath}` + `\\autocode\\Language\\CN`
	// console.log('=========filePath', filePath);
	for (let index = 0; index < 15; index++) {
		const fileName = filePath + '\\' + index + `.lua`
		
		if (fs.existsSync(fileName)) {
			// 读取 Lua 文件
			const luaCode = fs.readFileSync(fileName, 'utf8');
			const ast = luaParser.parse(luaCode);
			tryFindLanguageStr(ast);
			if (strValue != defaultStr) {
				break;
			}
		}
	}
}
function isNumber(str) {
	return typeof parseInt(str) === 'number' && !isNaN(parseInt(str));
}
function getSelectedText() {
	const editor = vscode.window.activeTextEditor;
	let str = '';
	if (editor) {
		const selection = editor.selection;
		str = editor.document.getText(selection);
	}
	return str;
}
function provideHover(document, position, token) {
	const word = document.getText(document.getWordRangeAtPosition(position));
	if (isNumber(word)) {
		id = parseInt(word);
		// console.log("id ", id)
		readLuaFiles();
		if (strValue) {
			let str = strValue;
			strValue = defaultStr;
			return new vscode.Hover(str);
		}
	}
}

function provideDefinition(document, position, token) {
	const word = document.getText(document.getWordRangeAtPosition(position));
	const filePath1 = `${vscode.workspace.rootPath}` + `\\base\\global.lua`;
	const filePath2 = `${vscode.workspace.rootPath}` + `\\panel\\Conf.lua`;

	// console.log('====== 进入 provideDefinition 方法 ======');
	// console.log('word: ' + word); // 当前光标所在单词
	const list = [filePath1, filePath2];
	destWord = word.toString();
	for (let index = 0; index < list.length; index++) {
		const fileName = list[index]
		if (fs.existsSync(fileName)) {
			// 读取 Lua 文件
			const luaCode = fs.readFileSync(fileName, 'utf8');
			const ast = luaParser.parse(luaCode);
			// console.log(ast);
			tryFindFilePath(ast);
			if (destPath != ''){
				break;
			}
		}
	}
	if (destPath != '') {
		destPath = convStr(destPath);
		destPath = destPath.replace(/\//g, '\\');
		const filePath = `${vscode.workspace.rootPath}` + `\\` + destPath;
		destPath = '';
		// console.log(filePath);
		return new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(0, 0));
	}
}

function activate(context) {
	console.log('Congratulations, your extension "y2tool" is now active!');
	// let disposable = vscode.commands.registerCommand('y2tool.helloWorld', function () {

	// 	let str = getSelectedText();
	// 	console.log("select str : ", str);
	// 	if (isNumber(str)) {
	// 		id = parseInt(str);
	// 		// console.log("id ", id)
	// 		readLuaFiles();
	// 	}
	// 	vscode.window.showInformationMessage('Hello World from y2tool!');
	// });
	// context.subscriptions.push(disposable);

	// 注册鼠标悬停提示
	context.subscriptions.push(vscode.languages.registerHoverProvider('lua', {
		provideHover
	}));

	// 注册如何实现跳转到定义
	context.subscriptions.push(vscode.languages.registerDefinitionProvider(['lua'], {
		provideDefinition
	}));
}

function deactivate() { }

module.exports = {
	activate,
	deactivate
}
