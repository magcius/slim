
import * as AST from "./AST";

function assert(b: boolean, message: string = ""): asserts b {
    if (!b)
        throw new Error(`Assert fail: ${message}`);
}

class Value {
    public isConst = false;

    public setConst() { this.isConst = true; return this; }
    public assertNonConst() { assert(!this.isConst); }

    public copy(): Value { throw "whoops"; }
    public set(o: Value) { throw "whoops"; }
    public evalBinOp(op: string, rhs: Value): Value { throw "whoops"; }
    public evalUnaryOp(op: string): Value { throw "whoops"; }
    public evalIndex(index: Value): Value { throw "whoops"; }
    public evalMember(id: string): Value { throw "whoops"; }
    public dumpString(): string { throw "whoops"; }
}

type Type = typeof Value;

class VoidValue extends Value {
    public dumpString() { return `void`; }
}

class FloatValue extends Value {
    constructor(public value: number = 0.0) {
        super();
    }

    public static cast(v: Value): FloatValue {
        assert(v instanceof FloatValue);
        return v as FloatValue;
    }

    public copy(): Value {
        return new FloatValue(this.value);
    }

    public set(o: Value) {
        this.assertNonConst();
        assert(o instanceof FloatValue);
        this.value = o.value;
    }

    public evalBinOp(op: string, rhs: Value): Value {
        if (rhs instanceof FloatValue)
            return this.evalBinOpFloat(op, rhs.value);
        else
            throw "whoops";
    }

    private evalBinOpFloat(op: string, rhs: number): Value {
        switch (op) {
        case '+': return new FloatValue(this.value + rhs);
        case '-': return new FloatValue(this.value - rhs);
        case '*': return new FloatValue(this.value * rhs);
        case '/': return new FloatValue(this.value / rhs);
        // TODO(jstpierre): mod in GLSL vs. HLSL
        // TODO(jstpierre): Integer typechecking
        case '%': return new FloatValue(this.value % rhs);
        case '|': return new FloatValue(this.value | rhs);
        case '&': return new FloatValue(this.value & rhs);
        case '^': return new FloatValue(this.value ^ rhs);
        case '>>': return new FloatValue(this.value >> rhs);
        case '<<': return new FloatValue(this.value << rhs);

        case '==': return new BoolValue(this.value === rhs);
        case '!=': return new BoolValue(this.value !== rhs);
        case '>=': return new BoolValue(this.value >= rhs);
        case '>': return new BoolValue(this.value > rhs);
        case '<=': return new BoolValue(this.value <= rhs);
        case '<': return new BoolValue(this.value < rhs);
        default: throw "whoops";
        }
    }

    public evalUnaryOp(op: string): Value {
        switch (op) {
        case '+': return this;
        case '-': return new FloatValue(-this.value);
        case '~': return new FloatValue(~this.value);
        case '!': return new BoolValue(!this.value);
        case '++E': return this.assertNonConst(), new FloatValue(++this.value);
        case '--E': return this.assertNonConst(), new FloatValue(--this.value);
        case 'E++': return this.assertNonConst(), new FloatValue(this.value++);
        case 'E--': return this.assertNonConst(), new FloatValue(this.value--);
        default: throw "whoops";
        }
    }

    public dumpString() { return `float(${this.value})`; }

    public static constructorN(scope: Scope, args: Value[]): Value {
        assert(args.length === 1);
        if (args[0] instanceof FloatValue)
            return args[0].copy();
        else
            throw "whoops";
    }
}

class BoolValue extends Value {
    constructor(public value: boolean = false) {
        super();
    }

    public copy(): Value {
        return new BoolValue(this.value);
    }

    public set(o: Value) {
        assert(o instanceof BoolValue);
        this.value = o.value;
    }

    public dumpString() { return `bool(${this.value})`; }

    public static constructorN(scope: Scope, args: Value[]): Value {
        assert(args.length === 1);
        if (args[0] instanceof FloatValue)
            return new BoolValue(!!args[0].value);
        else if (args[0] instanceof BoolValue)
            return args[0].copy();
        else
            throw "whoops";
    }
}

class VecBase<T> extends Value {
    public length = 1;
    public value!: T[];
}

function FloatVecClass(N: number) {
    const name = `float${N}`;
    const defaultValue = Array(N);
    const swizzle: { [k: string]: number } = {
        'x': 0, 'y': 1, 'z': 2, 'w': 3,
        's': 0, 't': 1, 'p': 2, 'q': 3,
        'r': 0, 'g': 1, 'b': 2, 'a': 3,
    };

    function splatN(v: number): number[] {
        const L: number[] = [];
        for (let i = 0; i < N; i++)
            L.push(v);
        return L;
    }

    return class VecValue extends VecBase<number> {
        public length = N;

        constructor(public value: number[] = defaultValue.slice()) {
            super();
        }

        public static splat(v: number): VecValue {
            return new VecValue(splatN(v));
        }

        public static cast(v: Value): FloatValue {
            assert(this instanceof FloatValue);
            return v as FloatValue;
        }

        public copy() {
            return new VecValue(this.value.slice());
        }

        private mapIndex(f: (v: number, i: number) => number) {
            return new VecValue(this.value.map(f));
        }

        public evalBinOp(op: string, rhs: Value): Value {
            let rhsV: number[];
            if (rhs instanceof FloatValue)
                rhsV = splatN(rhs.value);
            else if (rhs instanceof VecValue)
                rhsV = rhs.value;

            switch (op) {
            case '+': return this.mapIndex((v, i) => this.value[i] + rhsV[i]);
            case '-': return this.mapIndex((v, i) => this.value[i] - rhsV[i]);
            case '*': return this.mapIndex((v, i) => this.value[i] * rhsV[i]);
            case '/': return this.mapIndex((v, i) => this.value[i] / rhsV[i]);
            // TODO(jstpierre): mod in GLSL vs. HLSL
            // TODO(jstpierre): Integer typechecking
            case '%': return this.mapIndex((v, i) => this.value[i] % rhsV[i]);
            case '|': return this.mapIndex((v, i) => this.value[i] | rhsV[i]);
            case '&': return this.mapIndex((v, i) => this.value[i] & rhsV[i]);
            case '^': return this.mapIndex((v, i) => this.value[i] ^ rhsV[i]);
            case '>>': return this.mapIndex((v, i) => this.value[i] >> rhsV[i]);
            case '<<': return this.mapIndex((v, i) => this.value[i] << rhsV[i]);
            default: throw "whoops";
            }
        }

        public set(o: Value) {
            if (o instanceof VecValue)
                this.value = o.value.slice();
            else if (o instanceof FloatValue)
                this.value = splatN(o.value);
        }

        public evalIndex(index: Value): Value {
            const i = FloatValue.cast(index);
            return new FloatValue(this.value[i.value]);
        }

        public evalMember(id: string): Value {
            assert(id.length <= 4);
            if (id.length === 1) {
                assert(id in swizzle);
                const idx = swizzle[id];
                return new FloatValue(this.value[idx]);
            } else {
                return newFloatN(id.split('').map(v => {
                    assert(v in swizzle);
                    const idx = swizzle[v];
                    return this.value[idx];
                }));
            }
        }

        public dumpString() { return `${name}(${this.value.join(', ')})`; }

        public static constructorN(scope: Scope, args: Value[]): Value {
            if (args.length === 1 && args[0] instanceof FloatValue)
                return new VecValue(splatN(args[0].value));

            const numbers = args.flatMap((v) => {
                if (v instanceof VecBase)
                    return v.value;
                else if (v instanceof FloatValue)
                    return v.value;
            });

            assert(numbers.length >= 2 && numbers.length <= 4);
            return newFloatN(numbers);
        }
    };
}

const Float2Value = FloatVecClass(2);
const Float3Value = FloatVecClass(3);
const Float4Value = FloatVecClass(4);

function newFloatN(L: number[]): Value {
    switch (L.length) {
        case 1: return new FloatValue(L[0]);
        case 2: return new Float2Value(L);
        case 3: return new Float3Value(L);
        case 4: return new Float4Value(L);
        default: throw "Invalid Float size";
    }
}

function matchesFunctionDecl(scope: Scope, decl: AST.FunctionDecl, argTypes: Type[]): boolean {
    if (decl.params.length !== argTypes.length)
        return false;

    for (let i = 0; i < decl.params.length; i++)
        if (scope.getType(decl.params[i].type) !== argTypes[i])
            return false;

    return true;
}

function matchFunctionDecl(scope: Scope, mod: AST.Module, name: string, argTypes: Type[]): AST.FunctionDecl | null {
    for (const decl of mod.declarations)
        if (decl.kind === 'FunctionDecl' && decl.name === name)
            if (matchesFunctionDecl(scope, decl, argTypes))
                return decl;
    return null;
}

type NativeFunction = (scope: Scope, args: Value[]) => Value;

interface NativeFunctionEntry {
    func: NativeFunction;
    paramTypes: (Type | null)[] | null;
}

function matchNativeFunction(funcs: NativeFunctionEntry[], paramTypes: Type[]): NativeFunction | null {
    for (const entry of funcs) {
        if (entry.paramTypes === null)
            return entry.func;

        if (entry.paramTypes.length !== paramTypes.length)
            continue;

        for (let i = 0; i < paramTypes.length; i++)
            if (entry.paramTypes[i] !== null && entry.paramTypes[i] !== paramTypes[i])
                continue;

        return entry.func;
    }

    return null;
}

class Scope {
    private var = new Map<string, Value>();
    private type = new Map<string, Type>();
    private nativeFunc = new Map<string, NativeFunctionEntry[]>();

    public func: AST.FunctionDecl | null = null;
    public mod: AST.Module | null = null;

    constructor(private parent: Scope | null) {
    }

    public getVar(name: string): Value {
        if (this.var.has(name))
            return this.var.get(name)!;
        else if (this.parent !== null)
            return this.parent.getVar(name)!;
        else
            throw "whoops";
    }

    public setVar(name: string, v: Value): Value {
        this.var.set(name, v);
        return v;
    }

    public getType(name: string): Type {
        if (this.type.has(name))
            return this.type.get(name)!;
        else if (this.parent !== null)
            return this.parent.getType(name)!;
        else
            throw "whoops";
    }

    public setType(name: string, t: Type) {
        this.type.set(name, t);
    }

    public getRunningFunction(): AST.FunctionDecl {
        if (this.func !== null)
            return this.func;
        else if (this.parent !== null)
            return this.parent.getRunningFunction();
        else
            throw "whoops";
    }

    public getNativeFunction(name: string, paramTypes: Type[]): NativeFunction | null {
        if (this.nativeFunc.has(name)) {
            const candidate = matchNativeFunction(this.nativeFunc.get(name)!, paramTypes);
            if (candidate !== null)
                return candidate;
        }

        if (this.parent !== null)
            return this.parent.getNativeFunction(name, paramTypes);

        return null;
    }

    public setNativeFunc(name: string, func: NativeFunction, paramTypes: Type[] | null = null): void {
        if (!this.nativeFunc.has(name))
            this.nativeFunc.set(name, []);
        this.nativeFunc.get(name)!.push({ func, paramTypes });
    }

    public getFunctionDecl(name: string, paramTypes: Type[]): AST.FunctionDecl {
        if (this.mod !== null) {
            const candidate = matchFunctionDecl(this, this.mod, name, paramTypes);
            if (candidate !== null)
                return candidate;
        }

        if (this.parent !== null)
            return this.parent.getFunctionDecl(name, paramTypes);

        throw "whoops";
    }
}

export class Exec {
    private globalScope: Scope;
    private voidValue = new VoidValue();

    constructor(private mod: AST.Module) {
        this.globalScope = new Scope(null);
        this.globalScope.mod = this.mod;
        this.globalScope.setType('void', VoidValue);

        this.globalScope.setType('float', FloatValue);
        this.globalScope.setNativeFunc('float', FloatValue.constructorN);

        this.globalScope.setType('bool', BoolValue);
        this.globalScope.setNativeFunc('bool', BoolValue.constructorN);

        this.globalScope.setType('float2', Float2Value);
        this.globalScope.setNativeFunc('float2', Float2Value.constructorN);
        this.globalScope.setType('float3', Float3Value);
        this.globalScope.setNativeFunc('float3', Float3Value.constructorN);
        this.globalScope.setType('float4', Float4Value);
        this.globalScope.setNativeFunc('float4', Float4Value.constructorN);

        this.globalScope.setVar('false', new BoolValue(false).setConst());
        this.globalScope.setVar('true', new BoolValue(true).setConst());
        this.globalScope.setNativeFunc('print', this._func_print);
        this.globalScope.setNativeFunc('pow', this._func_pow_ff, [FloatValue, FloatValue]);

        for (const decl of mod.declarations)
            if (decl.kind === 'GlobalDecl')
                this.decl(this.globalScope, decl.name, decl.type, decl.init);
    }

    public evalFunction(name: string): string {
        const func = this.globalScope.getFunctionDecl(name, []);
        const scopeCall = new Scope(this.globalScope);
        scopeCall.func = func;

        const returnType = this.globalScope.getType(func.returnParam.type);
        const returnValue = new returnType();
        scopeCall.setVar(func.returnParam.name, returnValue);
        this.execFuncInternal(scopeCall, func);

        return returnValue.dumpString();
    }

    private decl(scope: Scope, name: string, type: string, init: AST.Expr | null): void {
        const t = scope.getType(type);
        const value = new t();
        if (init !== null)
            value.set(this.evalExpr(scope, init));
        scope.setVar(name, value);
    }

    private execFuncInternal(scope: Scope, func: AST.FunctionDecl): void {
        for (const s of func.body.body) {
            try {
                this.execStmt(scope, s);
            } catch(e) {
                if (e === 'Return')
                    return;
                throw e;
            }
        }
    }

    private getType(v: Value): Type {
        return v.constructor as Type;
    }

    private cond(value: Value): boolean {
        assert(value instanceof BoolValue);
        return value.value;
    }

    private execBlockStmt(scope: Scope, block: AST.BlockStmt): void {
        const scopeBlock = new Scope(scope);
        for (const s of block.body)
            this.execStmt(scopeBlock, s);
    }

    private execIfStmt(scope: Scope, stmt: AST.IfStmt): void {
        const scopeBlock = new Scope(scope);
        if (this.cond(this.evalExpr(scopeBlock, stmt.cond)))
            this.execStmt(scopeBlock, stmt.body);
        else if (stmt.elseBody !== null)
            this.execStmt(scopeBlock, stmt.elseBody);
    }

    private execForStmt(scope: Scope, stmt: AST.ForStmt): void {
        const scopeBlock = new Scope(scope);
        this.execStmt(scopeBlock, stmt.init);
        for (; this.cond(this.evalExpr(scopeBlock, stmt.cond)); this.evalExpr(scopeBlock, stmt.iter)) {
            try {
                this.execStmt(scopeBlock, stmt.body);
            } catch (e) {
                if (e === "Break")
                    break;
                else if (e === "Continue")
                    continue;
                throw e;
            }
        }
    }

    private execWhileStmt(scope: Scope, stmt: AST.WhileStmt): void {
        const scopeBlock = new Scope(scope);
        while (this.cond(this.evalExpr(scopeBlock, stmt.cond))) {
            try {
                this.execStmt(scopeBlock, stmt.body);
            } catch (e) {
                if (e === "Break")
                    break;
                else if (e === "Continue")
                    continue;
                throw e;
            }
        }
    }

    private execDoWhileStmt(scope: Scope, stmt: AST.DoWhileStmt): void {
        const scopeBlock = new Scope(scope);
        do {
            try {
                this.execStmt(scopeBlock, stmt.body);
            } catch (e) {
                if (e === "Break")
                    break;
                else if (e === "Continue")
                    continue;
                throw e;
            }
        } while (this.cond(this.evalExpr(scopeBlock, stmt.cond)));
    }

    private execDeclStmt(scope: Scope, stmt: AST.DeclStmt): void {
        this.decl(scope, stmt.name, stmt.type, stmt.init);
    }

    private execReturnStmt(scope: Scope, stmt: AST.ReturnStmt): void {
        if (stmt.rhs !== null) {
            const func = scope.getRunningFunction();
            const value = this.evalExpr(scope, stmt.rhs);
            const returnValue = scope.getVar(func.returnParam.name);
            returnValue.set(value);
        }

        throw "Return";
    }

    private execStmt(scope: Scope, stmt: AST.Stmt): void {
        switch (stmt.kind) {
        case 'BlockStmt':
            return this.execBlockStmt(scope, stmt);
        case 'IfStmt':
            return this.execIfStmt(scope, stmt);
        case 'ForStmt':
            return this.execForStmt(scope, stmt);
        case 'WhileStmt':
            return this.execWhileStmt(scope, stmt);
        case 'DoWhileStmt':
            return this.execDoWhileStmt(scope, stmt);
        case 'BreakStmt':
            throw "Break";
        case 'ContinueStmt':
            throw "Continue";
        case 'ExprStmt':
            this.evalExpr(scope, stmt.body);
            break;
        case 'DeclStmt':
            return this.execDeclStmt(scope, stmt);
        case 'ReturnStmt':
            return this.execReturnStmt(scope, stmt);
        }
    }

    private evalTernaryExpr(scope: Scope, expr: AST.TernaryExpr): Value {
        if (expr.op === '?:')
            return this.cond(this.evalExpr(scope, expr.expr)) ? this.evalExpr(scope, expr.lhs) : this.evalExpr(scope, expr.rhs);
        else
            throw "whoops";
    }

    private evalBinaryExpr(scope: Scope, expr: AST.BinaryExpr): Value {
        const lhs = this.evalExpr(scope, expr.lhs);
        const rhs = this.evalExpr(scope, expr.rhs);
        return lhs.evalBinOp(expr.op, rhs);
    }

    private evalUnaryExpr(scope: Scope, expr: AST.UnaryExpr): Value {
        const lhs = this.evalExpr(scope, expr.expr);
        return lhs.evalUnaryOp(expr.op);
    }

    private evalMemberExpr(scope: Scope, expr: AST.MemberExpr): Value {
        const lhs = this.evalExpr(scope, expr.lhs);
        return lhs.evalMember(expr.id);
    }

    private evalIndexExpr(scope: Scope, expr: AST.IndexExpr): Value {
        const lhs = this.evalExpr(scope, expr.lhs);
        const rhs = this.evalExpr(scope, expr.index);
        return lhs.evalIndex(rhs);
    }

    private evalStoreExpr(scope: Scope, expr: AST.StoreExpr): Value {
        const lhs = this.evalExpr(scope, expr.lhs);;
        const rhs = this.evalExpr(scope, expr.rhs);
        if (expr.op === '==')
            lhs.set(rhs);
        else
            lhs.set(lhs.evalBinOp(expr.op.slice(0, -1), rhs));
        return lhs;
    }

    private evalFloatLiteralExpr(scope: Scope, expr: AST.FloatLiteralExpr): Value {
        const v = new FloatValue(expr.val);
        v.isConst = true;
        return v;
    }

    private evalCallExpr(scope: Scope, expr: AST.CallExpr): Value {
        assert(expr.lhs.kind === 'LoadExpr');

        const argValues: Value[] = [];
        const argTypes: Type[] = [];
        for (const arg of expr.args) {
            const paramValue = this.evalExpr(scope, arg);
            argValues.push(paramValue);
            argTypes.push(this.getType(paramValue));
        }

        const name = expr.lhs.id;
        const nativeFunc = scope.getNativeFunction(name, argTypes);
        if (nativeFunc !== null) {
            return nativeFunc.call(this, scope, argValues);
        } else {
            const func = scope.getFunctionDecl(name, argTypes);
            const scopeCall = new Scope(this.globalScope);
            scopeCall.func = func;

            for (let i = 0; i < argValues.length; i++) {
                const paramDecl = func.params[i];

                // In = copy the value
                // Out = pass by reference
                // InOut = pass by reference

                let paramValue = argValues[i];
                if (!(paramDecl.flags & AST.FunctionParamFlags.Out)) {
                    // Copy the value.
                    paramValue = paramValue.copy();
                }

                scopeCall.setVar(func.params[i].name, paramValue);
            }

            const returnType = scope.getType(func.returnParam.type);
            const returnValue = new returnType();
            scopeCall.setVar(func.returnParam.name, returnValue);
            this.execFuncInternal(scopeCall, func);
            return returnValue;
        }
    }

    private evalExpr(scope: Scope, expr: AST.Expr): Value {
        switch (expr.kind) {
        case 'TernaryExpr':
            return this.evalTernaryExpr(scope, expr);
        case 'BinaryExpr':
            return this.evalBinaryExpr(scope, expr);
        case 'UnaryExpr':
            return this.evalUnaryExpr(scope, expr);
        case 'MemberExpr':
            return this.evalMemberExpr(scope, expr);
        case 'IndexExpr':
            return this.evalIndexExpr(scope, expr);
        case 'LoadExpr':
            return scope.getVar(expr.id);
        case 'StoreExpr':
            return this.evalStoreExpr(scope, expr);
        case 'FloatLiteralExpr':
            return this.evalFloatLiteralExpr(scope, expr);
        case 'CallExpr':
            return this.evalCallExpr(scope, expr);
        }
    }

    // Native functions
    private _func_print(scope: Scope, args: Value[]): Value {
        console.log(... args.map(v => v.dumpString()));
        return this.voidValue;
    }

    private _func_pow_ff(scope: Scope, args: Value[]): Value {
        const lhs = FloatValue.cast(args[0]).value, rhs = FloatValue.cast(args[1]).value;
        return new FloatValue(Math.pow(lhs, rhs));
    }
}
