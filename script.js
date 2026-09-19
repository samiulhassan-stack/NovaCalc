
"use strict";

/* NovaCalc — Scientific Calculator
   No eval() is used. Expressions are evaluated by a small parser.
*/

const expressionDisplay = document.getElementById("expression");
const resultDisplay = document.getElementById("result");
const errorMessage = document.getElementById("errorMessage");
const keypad = document.getElementById("keypad");
const angleToggle = document.getElementById("angleToggle");
const angleLabel = document.getElementById("angleLabel");
const themeToggle = document.getElementById("themeToggle");
const historyList = document.getElementById("historyList");
const clearHistoryButton = document.getElementById("clearHistory");
const memoryLabel = document.getElementById("memoryLabel");

let expression = "";
let lastAnswer = 0;
let angleMode = "DEG";
let justCalculated = false;
let history = [];

const FUNCTIONS = new Set([
  "sin", "cos", "tan",
  "asin", "acos", "atan",
  "log", "ln", "sqrt", "cbrt",
  "abs", "pow"
]);

/* ---------- Display helpers ---------- */

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    throw new Error("Result is outside the supported range.");
  }

  if (Object.is(value, -0)) value = 0;

  const rounded = Number(value.toPrecision(12));
  return String(rounded);
}

function prettyExpression(value) {
  return value
    .replace(/\bpi\b/gi, "π")
    .replace(/\*/g, "×")
    .replace(/\//g, "÷")
    .replace(/sqrt\(/g, "√(")
    .replace(/cbrt\(/g, "∛(")
    .replace(/asin\(/g, "sin⁻¹(")
    .replace(/acos\(/g, "cos⁻¹(")
    .replace(/atan\(/g, "tan⁻¹(");
}

function updateDisplay() {
  expressionDisplay.textContent = prettyExpression(expression);
  resultDisplay.textContent = expression ? resultDisplay.textContent : "0";
  angleToggle.textContent = angleMode;
  angleLabel.textContent = angleMode;
  errorMessage.textContent = "";
}

function showError(message) {
  errorMessage.textContent = message;
}

function setExpression(value) {
  expression = value;
  expressionDisplay.textContent = prettyExpression(expression);
  errorMessage.textContent = "";
}

function appendText(value) {
  if (justCalculated && /[0-9.(pi e]/i.test(value)) {
    expression = "";
    resultDisplay.textContent = "0";
  }

  justCalculated = false;
  expression += value;
  expressionDisplay.textContent = prettyExpression(expression);
  errorMessage.textContent = "";
}

function appendNumber(number) {
  if (justCalculated) {
    expression = "";
    resultDisplay.textContent = "0";
  }

  justCalculated = false;
  expression += number;
  expressionDisplay.textContent = prettyExpression(expression);
  errorMessage.textContent = "";
}

function appendOperator(operator) {
  if (!expression) {
    if (operator === "-") appendText("-");
    return;
  }

  justCalculated = false;

  if (/[+\-*/^]$/.test(expression)) {
    expression = expression.slice(0, -1) + operator;
  } else {
    expression += operator;
  }

  expressionDisplay.textContent = prettyExpression(expression);
  errorMessage.textContent = "";
}

function appendFunction(name) {
  if (justCalculated) {
    expression = "";
    resultDisplay.textContent = "0";
  }

  justCalculated = false;
  expression += `${name}(`;
  expressionDisplay.textContent = prettyExpression(expression);
  errorMessage.textContent = "";
}

function appendConstant(constant) {
  appendText(constant);
}

function clearAll() {
  expression = "";
  justCalculated = false;
  expressionDisplay.textContent = "";
  resultDisplay.textContent = "0";
  errorMessage.textContent = "";
}

function deleteLast() {
  if (justCalculated) {
    clearAll();
    return;
  }

  if (!expression) return;

  const functionNames = [
    "asin(", "acos(", "atan(",
    "sqrt(", "cbrt(", "sin(", "cos(", "tan(",
    "log(", "abs(", "pow(", "ln("
  ];

  const matchingFunction = functionNames.find((name) => expression.endsWith(name));

  if (matchingFunction) {
    expression = expression.slice(0, -matchingFunction.length);
  } else {
    expression = expression.slice(0, -1);
  }

  expressionDisplay.textContent = prettyExpression(expression);
  errorMessage.textContent = "";
}

function appendDecimal() {
  if (justCalculated) {
    expression = "";
    resultDisplay.textContent = "0";
  }

  justCalculated = false;

  // Add a leading zero for a decimal starting a new number.
  const currentNumber = expression.match(/(?:^|[+\-*/^(])(\d*\.?\d*)$/);
  if (!currentNumber || currentNumber[1] === "") {
    expression += "0.";
  } else if (!currentNumber[1].includes(".")) {
    expression += ".";
  }

  expressionDisplay.textContent = prettyExpression(expression);
  errorMessage.textContent = "";
}

function toggleSign() {
  if (!expression) {
    expression = "-";
  } else if (justCalculated) {
    expression = `-(${formatNumber(lastAnswer)})`;
    justCalculated = false;
  } else {
    const match = expression.match(/(\d*\.?\d+(?:e[+-]?\d+)?)$/i);

    if (match) {
      const numberText = match[1];
      const start = match.index;
      const before = expression.slice(0, start);

      if (before.endsWith("-") && (before.length === 1 || /[+\-*/^(]$/.test(before.slice(0, -1)))) {
        expression = before.slice(0, -1) + numberText;
      } else {
        expression = before + "(-" + numberText + ")";
      }
    } else {
      expression = `-(${expression})`;
    }
  }

  expressionDisplay.textContent = prettyExpression(expression);
  errorMessage.textContent = "";
}

function applyPostfix(action) {
  if (!expression) return;

  if (justCalculated) {
    expression = formatNumber(lastAnswer);
    justCalculated = false;
  }

  if (action === "square") expression = `(${expression})^2`;
  if (action === "factorial") expression = `(${expression})!`;
  if (action === "inverse") expression = `1/(${expression})`;
  if (action === "sqrt") expression = `sqrt(${expression})`;
  if (action === "cbrt") expression = `cbrt(${expression})`;
  if (action === "abs") expression = `abs(${expression})`;
  if (action === "power") expression += "^";
  if (action === "percent") expression = `((${expression})/100)`;

  expressionDisplay.textContent = prettyExpression(expression);
  errorMessage.textContent = "";
}

/* ---------- Expression tokenizer and parser ---------- */

function tokenize(source) {
  const pattern =
    /\s*([0-9]*\.?[0-9]+(?:e[+-]?[0-9]+)?|pi|e|sqrt|cbrt|sin|cos|tan|asin|acos|atan|log|ln|abs|pow|[(),+\-*/^!])/igy;

  const tokens = [];
  let position = 0;

  while (position < source.length) {
    pattern.lastIndex = position;
    const match = pattern.exec(source);

    if (!match || match.index !== position) {
      throw new Error(`Invalid input near "${source.slice(position, position + 8)}".`);
    }

    tokens.push(match[1].toLowerCase());
    position = pattern.lastIndex;
  }

  return tokens;
}

function evaluateExpression(source) {
  const tokens = tokenize(source);
  let position = 0;

  function peek() {
    return tokens[position];
  }

  function consume(expected) {
    const token = tokens[position];

    if (expected !== undefined && token !== expected) {
      throw new Error(`Expected "${expected}".`);
    }

    position++;
    return token;
  }

  function parseExpression() {
    let value = parseTerm();

    while (peek() === "+" || peek() === "-") {
      const operator = consume();
      const right = parseTerm();
      value = operator === "+" ? value + right : value - right;
    }

    return value;
  }

  function parseTerm() {
    let value = parseUnary();

    while (peek() === "*" || peek() === "/") {
      const operator = consume();
      const right = parseUnary();

      if (operator === "/" && right === 0) {
        throw new Error("Cannot divide by zero.");
      }

      value = operator === "*" ? value * right : value / right;
    }

    return value;
  }

  function parseUnary() {
    if (peek() === "+") {
      consume("+");
      return parseUnary();
    }

    if (peek() === "-") {
      consume("-");
      return -parseUnary();
    }

    return parsePower();
  }

  function parsePower() {
    let value = parsePostfix();

    if (peek() === "^") {
      consume("^");
      const exponent = parseUnary();
      value = Math.pow(value, exponent);
    }

    return value;
  }

  function parsePostfix() {
    let value = parsePrimary();

    while (peek() === "!") {
      consume("!");
      value = factorial(value);
    }

    return value;
  }

  function parsePrimary() {
    const token = peek();

    if (token === undefined) {
      throw new Error("Incomplete expression.");
    }

    if (token === "(") {
      consume("(");
      const value = parseExpression();
      consume(")");
      return value;
    }

    if (FUNCTIONS.has(token)) {
      const functionName = consume();
      consume("(");

      const firstArgument = parseExpression();
      let secondArgument;

      if (peek() === ",") {
        consume(",");
        secondArgument = parseExpression();
      }

      consume(")");

      if (functionName === "pow") {
        if (secondArgument === undefined) {
          throw new Error("Use pow(base, exponent).");
        }
        return Math.pow(firstArgument, secondArgument);
      }

      if (secondArgument !== undefined) {
        throw new Error("This function accepts one argument.");
      }

      return applyFunction(functionName, firstArgument);
    }

    if (token === "pi") {
      consume();
      return Math.PI;
    }

    if (token === "e") {
      consume();
      return Math.E;
    }

    if (/^[0-9]/.test(token) || /^\./.test(token)) {
      consume();
      const value = Number(token);

      if (!Number.isFinite(value)) {
        throw new Error("Invalid number.");
      }

      return value;
    }

    throw new Error(`Unexpected token "${token}".`);
  }

  const result = parseExpression();

  if (position < tokens.length) {
    throw new Error(`Unexpected token "${peek()}".`);
  }

  if (!Number.isFinite(result)) {
    throw new Error("Result is outside the supported range.");
  }

  return result;
}

function factorial(value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("Factorial requires a non-negative integer.");
  }

  if (value > 170) {
    throw new Error("Factorial is too large.");
  }

  let result = 1;

  for (let i = 2; i <= value; i++) {
    result *= i;
  }

  return result;
}

function applyFunction(name, value) {
  const radians = angleMode === "DEG" ? (value * Math.PI) / 180 : value;

  switch (name) {
    case "sin":
      return Math.sin(radians);

    case "cos":
      return Math.cos(radians);

    case "tan":
      if (Math.abs(Math.cos(radians)) < 1e-12) {
        throw new Error("Tangent is undefined at this angle.");
      }
      return Math.tan(radians);

    case "asin":
      if (value < -1 || value > 1) {
        throw new Error("Inverse sine requires a value from −1 to 1.");
      }
      return angleMode === "DEG"
        ? (Math.asin(value) * 180) / Math.PI
        : Math.asin(value);

    case "acos":
      if (value < -1 || value > 1) {
        throw new Error("Inverse cosine requires a value from −1 to 1.");
      }
      return angleMode === "DEG"
        ? (Math.acos(value) * 180) / Math.PI
        : Math.acos(value);

    case "atan":
      return angleMode === "DEG"
        ? (Math.atan(value) * 180) / Math.PI
        : Math.atan(value);

    case "log":
      if (value <= 0) throw new Error("log requires a positive number.");
      return Math.log10(value);

    case "ln":
      if (value <= 0) throw new Error("ln requires a positive number.");
      return Math.log(value);

    case "sqrt":
      if (value < 0) throw new Error("Square root requires a non-negative number.");
      return Math.sqrt(value);

    case "cbrt":
      return Math.cbrt(value);

    case "abs":
      return Math.abs(value);

    default:
      throw new Error("Unsupported function.");
  }
}

/* ---------- Calculate and history ---------- */

function calculate() {
  if (!expression.trim()) return;

  const originalExpression = expression;

  try {
    const value = evaluateExpression(originalExpression);
    const formatted = formatNumber(value);

    lastAnswer = value;
    resultDisplay.textContent = formatted;
    expressionDisplay.textContent = prettyExpression(originalExpression);
    memoryLabel.textContent = "Ans = " + formatted;
    errorMessage.textContent = "";

    addHistory(originalExpression, formatted);
    justCalculated = true;
  } catch (error) {
    showError(error.message || "Unable to calculate this expression.");
  }
}

function addHistory(expressionText, resultText) {
  history.unshift({
    expression: expressionText,
    result: resultText
  });

  history = history.slice(0, 12);
  renderHistory();
}

function renderHistory() {
  historyList.replaceChildren();

  if (history.length === 0) {
    const empty = document.createElement("div");
    empty.className = "history-empty";

    const icon = document.createElement("span");
    icon.className = "history-empty-icon";
    icon.textContent = "∑";

    const title = document.createElement("p");
    title.textContent = "No calculations yet";

    const description = document.createElement("span");
    description.textContent = "Your results will appear here.";

    empty.append(icon, title, description);
    historyList.appendChild(empty);
    return;
  }

  history.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-item";
    button.setAttribute("aria-label", `Reuse result ${item.result}`);

    const expr = document.createElement("span");
    expr.className = "history-expression";
    expr.textContent = prettyExpression(item.expression);

    const result = document.createElement("span");
    result.className = "history-result";
    result.textContent = "= " + item.result;

    button.append(expr, result);

    button.addEventListener("click", () => {
      expression = item.result;
      resultDisplay.textContent = item.result;
      expressionDisplay.textContent = prettyExpression(expression);
      lastAnswer = Number(item.result);
      justCalculated = true;
      errorMessage.textContent = "";
    });

    historyList.appendChild(button);
  });
}

/* ---------- Theme and angle mode ---------- */

function setTheme(theme) {
  const light = theme === "light";
  document.body.classList.toggle("light-theme", light);
  themeToggle.textContent = light ? "☾" : "☼";
  themeToggle.setAttribute(
    "aria-label",
    light ? "Switch to dark theme" : "Switch to light theme"
  );

  try {
    localStorage.setItem("novacalc-theme", theme);
  } catch {
    // The calculator still works if storage is unavailable.
  }
}

function loadTheme() {
  let savedTheme = "dark";

  try {
    savedTheme = localStorage.getItem("novacalc-theme") || "dark";
  } catch {
    // Use the default theme if storage is unavailable.
  }

  setTheme(savedTheme);
}

angleToggle.addEventListener("click", () => {
  angleMode = angleMode === "DEG" ? "RAD" : "DEG";
  angleToggle.textContent = angleMode;
  angleLabel.textContent = angleMode;
});

themeToggle.addEventListener("click", () => {
  const isLight = document.body.classList.contains("light-theme");
  setTheme(isLight ? "dark" : "light");
});

clearHistoryButton.addEventListener("click", () => {
  history = [];
  renderHistory();
});

/* ---------- Button interaction ---------- */

keypad.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.dataset.number !== undefined) {
    appendNumber(button.dataset.number);
    return;
  }

  if (button.dataset.operator) {
    appendOperator(button.dataset.operator);
    return;
  }

  if (button.dataset.value) {
    appendConstant(button.dataset.value);
    return;
  }

  if (button.dataset.func) {
    appendFunction(button.dataset.func);
    return;
  }

  switch (button.dataset.action) {
    case "clear":
      clearAll();
      break;

    case "delete":
      deleteLast();
      break;

    case "decimal":
      appendDecimal();
      break;

    case "equals":
      calculate();
      break;

    case "square":
    case "power":
    case "sqrt":
    case "cbrt":
    case "factorial":
    case "inverse":
    case "abs":
    case "percent":
      applyPostfix(button.dataset.action);
      break;

    case "sign":
      toggleSign();
      break;

   case "answer":
  appendText(formatNumber(lastAnswer));
  break;
  }
});

/* ---------- Keyboard support ---------- */

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;

  const key = event.key;

  if (/^[0-9]$/.test(key)) {
    appendNumber(key);
    return;
  }

  if (["+", "-", "*", "/", "^"].includes(key)) {
    appendOperator(key);
    return;
  }

  if (key === ".") {
    appendDecimal();
    return;
  }

  if (key === "(" || key === ")") {
    appendText(key);
    return;
  }

  if (key === "!") {
    applyPostfix("factorial");
    return;
  }

  if (key === "%") {
    applyPostfix("percent");
    return;
  }

  if (key === "Enter" || key === "=") {
    event.preventDefault();
    calculate();
    return;
  }

  if (key === "Backspace") {
    event.preventDefault();
    deleteLast();
    return;
  }

  if (key === "Escape") {
    clearAll();
    return;
  }

  // Convenience shortcuts for constants.
  if (key.toLowerCase() === "p") {
    appendConstant("pi");
  } else if (key.toLowerCase() === "e") {
    appendConstant("e");
  }
});

/* ---------- Initialization ---------- */

document.getElementById("year").textContent = new Date().getFullYear();

loadTheme();
renderHistory();
updateDisplay();