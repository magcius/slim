
// Parser/Lexer for a shading language

import * as AST from "./AST";

function assert(b: boolean, message: string = ""): asserts b {
    if (!b)
        throw new Error(`Assert fail: ${message}`);
}

interface TokenNum { kind: 'Num'; num: number; }
interface TokenStr { kind: 'Str'; str: string; }
interface TokenID { kind: 'ID'; id: string; }
interface TokenComment { kind: 'Comment', contents: string; }
interface TokenOther { kind: string; }

type Token = TokenNum | TokenStr | TokenID | TokenComment | TokenOther;

function constructBasicTokens(m: string[]) {
    type LiteralToken = { length: number, m: string[] };
    const o: { [k: string]: LiteralToken } = {};
    const p: LiteralToken[] = [];
    for (const t of m) {
        const len = t.length;
        let nl = o[len];
        if (!nl) {
            nl = o[len] = { length: len, m: [] };
            p.push(nl);
        }
        nl.m.push(t);
    }
    p.sort((a, b) => (b.length - a.length));
    return p;
}

class Lexer {
    private c = 0;

    constructor(private s: string) {
    }

    public save() { return this.c; }
    public restore(c: number) { this.c = c; }

    private headChar(): string { return this.s[this.c]; }
    private nextChar(): string { return this.s[this.c++]; }
    private nextSlice(n: number) { return this.s.slice(this.c, this.c + n); }
    private advance(n: number) { this.c += n; }

    private number(): Token {
        let b = '';
        while (this.headChar().match(/[0-9.ef]/))
            b += this.nextChar();
        return { kind: 'Num', num: parseFloat(b) };
    }

    private string(b: string):Token {
        const d = b;
        while (true) {
            const c = this.nextChar();
            if (c === '\\') {
                const c2 = this.nextChar();
                switch (c2) {
                case 'n': b += '\n';
                case 'r': b += '\r';
                case 't': b += '\t';
                default: b += c2;
                // xxx: \x / \u
                }
            } else if (c === d) {
                break;
            } else {
                b += c;
            }
        }

        return { kind: 'Str', str: b };
    }

    private basicTokens = constructBasicTokens([
        '==', '!=', '<', '<=', '>=', '>',
        '||', '&&',
        '|', '&', '^',
        '>>', '<<',
        '+', '-',
        '*', '/', '%',
        '!', '~',

        '=',
        '||=', '&&=',
        '|=', '&=', '^=',
        '>>=', '<<=',
        '+=', '-=',
        '*=', '/=', '%=',
        '!=', '~=',

        '(', ')', '{', '}', '[', ']',
        '.', ',', ';', '//', '/*', '?', ':',
    ]);
    private keywords = ['struct', 'return', 'in', 'out', 'inout', 'if', 'else', 'for', 'while', 'do', 'const', 'static'];

    private identifier(): Token {
        let b = '';
        do { b += this.nextChar(); } while(b.match(/[a-zA-Z$_][a-zA-Z0-9$_]*$/));
        this.advance(-1);
        b = b.slice(0, -1);
        return { kind: 'ID', id: b };
    }

    private comment(): Token {
        let b = '';
        do { b += this.nextChar(); } while (!b.match(/[\r\n]/));
        return { kind: 'Comment', contents: b };
    }

    private multiLineComment(): Token {
        let b = '';
        while (this.nextSlice(2) !== '*/')
            b += this.nextChar();
        this.advance(2);
        return { kind: 'Comment', contents: b };
    }

    private nextInternal(): Token | null {
        while (true) {
            const m = this.headChar();
            if (m === undefined)
                return null;
            // ignore white
            if (m.match(/\s/) && this.nextChar())
                continue;
            if (m.match(/\d/))
                return this.number();
            if (m === '\'' || m === '"')
                return this.string(m);

            for (const group of this.basicTokens) {
                const token = this.nextSlice(group.length);
                if (group.m.includes(token)) {
                    this.advance(group.length);

                    if (token === '//')
                        return this.comment();
                    else if (token === '/*')
                        return this.multiLineComment();
                    else
                        return { kind: token };
                }
            }

            for (const kw of this.keywords) {
                const c = this.nextSlice(kw.length + 1);
                if (c.slice(0, kw.length) === kw && !c[kw.length].match(/[a-zA-Z0-9$_]/)) {
                    this.advance(kw.length);
                    return { kind: kw };
                }
            }

            return this.identifier();
        }
    }

    public next(): Token | null {
        while (true) {
            const tok = this.nextInternal();
            if (tok !== null && tok.kind === 'Comment')
                continue;
            return tok;
        }
    }
}

interface ParserState {
    lexer: ReturnType<typeof Lexer.prototype.save>;
    c: Token | null;
}

class Parser {
    constructor(private lexer: Lexer) {
        this.nextToken();
    }

    private c: Token | null = null;

    private headKind(): string | null {
        if (this.c !== null)
            return this.c.kind;
        else
            return null;
    }

    private save() {
        const lexer = this.lexer.save();
        const c = this.c;
        return { lexer, c };
    }

    private restore(s: ParserState) {
        this.lexer.restore(s.lexer);
        this.c = s.c;
    }

    private nextToken(): Token | null {
        const old = this.c;
        // console.log(old);
        this.c = this.lexer.next();
        return old;
    }

    private expect<T extends Token>(k: string): T {
        const m = this.nextToken();
        assert(m !== null && m.kind === k);
        return m as T;
    }

    private predicate(k: string): boolean {
        return this.headKind() === k;
    }

    private match(k:string): boolean {
        if (!this.predicate(k))
            return false;
        this.nextToken();
        return true;
    }

    private expectID() {
        return this.expect<TokenID>('ID').id;
    }

    private expectNumber() {
        return this.expect<TokenNum>('Num').num;
    }

    private parenExpr(): AST.Expr {
        this.expect('(');
        const expr = this.expr();
        this.expect(')');
        return expr;
    }

    private value(): AST.Expr {
        switch (this.headKind()) {
        case 'ID':
            return { kind: 'LoadExpr', id: this.expectID() };
        case 'Num':
            return { kind: 'FloatLiteralExpr', val: this.expectNumber() };
        case '+':
        case '-':
            return this.unaryExpr();
        case '(':
            return this.parenExpr();
        default:
            assert(false);
        }
    }

    private argumentList(): AST.Expr[] {
        const params: AST.Expr[] = [];
        this.expect('(');
        while (!this.predicate(')')) {
            params.push(this.expr());
            if (!this.match(','))
                break;
        }
        this.expect(')');
        return params;
    }

    private memberExprR(lhs: AST.Expr): AST.Expr {
        if (this.match('[')) {
            const index = this.expr();
            this.expect(']');
            return this.memberExprR({ kind: 'IndexExpr', lhs, index });
        } else if (this.match('.')) {
            const id = this.expectID();
            return this.memberExprR({ kind: 'MemberExpr', lhs, id });
        } else {
            return lhs;
        }
    }

    private memberExpr(): AST.Expr {
        const lhs = this.value();
        return this.memberExprR(lhs);
    }

    private callExprR(lhs: AST.Expr): AST.Expr {
        if (this.headKind() === '(') {
            const args = this.argumentList();
            return this.callExprR({ kind: 'CallExpr', lhs, args });
        } else if (['.', '['].includes(this.headKind()!)) {
            return this.memberExprR(lhs);
        } else {
            return lhs;
        }
    }

    private callExpr(): AST.Expr {
        const lhs = this.memberExpr();
        if (this.headKind() === '(') {
            const args = this.argumentList();
            return this.callExprR({ kind: 'CallExpr', lhs, args });
        } else {
            return lhs;
        }
    }

    private postfixExpr(): AST.Expr {
        const expr = this.callExpr();
        if (this.match('++'))
            return { kind: 'UnaryExpr', op: 'E++', expr };
        else if (this.match('--'))
            return { kind: 'UnaryExpr', op: 'E--', expr };
        return expr;
    }

    private unaryExpr(): AST.Expr {
        if (this.match('++')) {
            return { kind: 'UnaryExpr', op: '++E', expr: this.postfixExpr() };
        } else if (this.match('--')) {
            return { kind: 'UnaryExpr', op: '--E', expr: this.postfixExpr() };
        } else if (['!', '~', '+', '-'].includes(this.headKind()!)) {
            const op = this.nextToken()!.kind;
            return { kind: 'UnaryExpr', op, expr: this.unaryExpr() };
        } else {
            return this.postfixExpr();
        }
    }

    private multiplicativeExpr(): AST.Expr {
        let lhs = this.unaryExpr();
        while (['*', '/', '%'].includes(this.headKind()!)) {
            const op = this.nextToken()!.kind;
            const rhs = this.unaryExpr();
            lhs = { kind: 'BinaryExpr', op, lhs, rhs };
        }
        return lhs;
    }

    private additiveExpr(): AST.Expr {
        let lhs = this.multiplicativeExpr();
        while (['+', '-'].includes(this.headKind()!)) {
            const op = this.nextToken()!.kind;
            const rhs = this.multiplicativeExpr();
            lhs = { kind: 'BinaryExpr', op, lhs, rhs };
        }
        return lhs;
    }

    private shiftExpr(): AST.Expr {
        let lhs = this.additiveExpr();
        while (['<<', '>>'].includes(this.headKind()!)) {
            const op = this.nextToken()!.kind;
            const rhs = this.additiveExpr();
            lhs = { kind: 'BinaryExpr', op, lhs, rhs };
        }
        return lhs;
    }

    private relationalExpr(): AST.Expr {
        let lhs = this.shiftExpr();
        while (['<', '<=', '>', '>='].includes(this.headKind()!)) {
            const op = this.nextToken()!.kind;
            const rhs = this.shiftExpr();
            lhs = { kind: 'BinaryExpr', op, lhs, rhs };
        }
        return lhs;
    }

    private equalityExpr(): AST.Expr {
        let lhs = this.relationalExpr();
        while (['==', '!='].includes(this.headKind()!)) {
            const op = this.nextToken()!.kind;
            const rhs = this.relationalExpr();
            lhs = { kind: 'BinaryExpr', op, lhs, rhs };
        }
        return lhs;
    }

    private bitwiseAndExpr(): AST.Expr {
        let lhs = this.equalityExpr();
        while (this.headKind() === '&') {
            const op = this.nextToken()!.kind;
            const rhs = this.equalityExpr();
            lhs = { kind: 'BinaryExpr', op, lhs, rhs };
        }
        return lhs;
    }

    private bitwiseXorExpr(): AST.Expr {
        let lhs = this.bitwiseAndExpr();
        while (this.headKind() === '^') {
            const op = this.nextToken()!.kind;
            const rhs = this.bitwiseAndExpr();
            lhs = { kind: 'BinaryExpr', op, lhs, rhs };
        }
        return lhs;
    }

    private bitwiseOrExpr(): AST.Expr {
        let lhs = this.bitwiseXorExpr();
        while (this.headKind() === '|') {
            const op = this.nextToken()!.kind;
            const rhs = this.bitwiseXorExpr();
            lhs = { kind: 'BinaryExpr', op, lhs, rhs };
        }
        return lhs;
    }

    private logicalAndExpr(): AST.Expr {
        let lhs = this.bitwiseOrExpr();
        while (this.headKind() === '&&') {
            const op = this.nextToken()!.kind;
            const rhs = this.bitwiseOrExpr();
            lhs = { kind: 'BinaryExpr', op, lhs, rhs };
        }
        return lhs;
    }

    private logicalOrExpr(): AST.Expr {
        let lhs = this.logicalAndExpr();
        while (this.headKind() === '||') {
            const op = this.nextToken()!.kind;
            const rhs = this.logicalAndExpr();
            lhs = { kind: 'BinaryExpr', op, lhs, rhs };
        }
        return lhs;
    }

    private ternaryExpr(): AST.Expr {
        const expr = this.logicalOrExpr();
        if (this.match('?')) {
            const lhs = this.assignmentExpression();
            this.expect(':');
            const rhs = this.assignmentExpression();
            return { kind: 'TernaryExpr', op: '?:', expr, lhs, rhs };
        } else {
            return expr;
        }
    }

    private assignmentExpression(): AST.Expr {
        const lhs = this.ternaryExpr();
        if (['=', '||=', '&&=', '|=', '&=', '^=', '>>=', '<<=', '+=', '-=', '*=', '/=', '%=', '!=', '~=', ].includes(this.headKind()!)) {
            const op = this.nextToken()!.kind;
            const rhs = this.assignmentExpression();
            return { kind: 'StoreExpr', op, lhs, rhs };
        } else {
            return lhs;
        }
    }

    private expr(): AST.Expr {
        return this.assignmentExpression();
    }

    private ifStmt(): AST.Stmt {
        this.expect('if');
        this.expect('(');
        const cond = this.expr();
        this.expect(')');
        const body = this.stmt();
        let elseBody: AST.Stmt | null = null;
        if (this.match('else'))
            elseBody = this.stmt();
        return { kind: 'IfStmt', cond, body, elseBody };
    }

    private returnStmt(): AST.Stmt {
        this.expect('return');
        let rhs: AST.Expr | null = null;
        if (!this.match(';')) {
            rhs = this.expr();
            this.match(';');
        }
        return { kind: 'ReturnStmt', rhs };
    }

    private exprStmt(): AST.Stmt {
        const body = this.expr();
        this.expect(';');
        return { kind: 'ExprStmt', body };
    }

    private exprOrDeclStmt(): AST.Stmt {
        const save = this.save();

        this.match('static');
        const isConst = this.match('const');
        if (this.headKind() === 'ID') {
            const type = this.expectID();
            if (this.headKind() === 'ID') {
                const name = this.expectID();
                let init: AST.Expr | null = null;
                if (this.match('='))
                    init = this.expr();
                this.expect(';');
                return { kind: 'DeclStmt', type, name, init, isConst };
            }
        }

        this.restore(save);
        return this.exprStmt();
    }

    private blockStmt(): AST.BlockStmt {
        this.expect('{');
        const body: AST.Stmt[] = [];
        while (!this.match('}'))
            body.push(this.stmt());
        return { kind: "BlockStmt", body };
    }

    private forStmt(): AST.Stmt {
        this.expect('for');

        this.expect('(');
        const init = this.stmt();
        this.expect(';');
        const cond = this.expr();
        this.expect(';');
        const iter = this.expr();
        this.expect(')');

        const body = this.stmt();
        return { kind: 'ForStmt', init, cond, iter, body };
    }

    private whileStmt(): AST.Stmt {
        this.expect('while');
        this.expect('(');
        const cond = this.expr();
        this.expect(')');
        const body = this.stmt();
        return { kind: 'WhileStmt', cond, body };
    }

    private doStmt(): AST.Stmt {
        this.expect('do');
        const body = this.stmt();
        this.expect('while');
        this.expect('(');
        const cond = this.expr();
        this.expect(')');
        return { kind: 'DoWhileStmt', cond, body };
    }

    private stmt(): AST.Stmt {
        switch (this.headKind()) {
        case 'if'    : return this.ifStmt();
        case 'return': return this.returnStmt();
        case 'for'   : return this.forStmt();
        case 'while' : return this.whileStmt();
        case 'do'    : return this.doStmt();
        case '{'     : return this.blockStmt();
        case 'break' : return { kind: 'BreakStmt' };
        case 'continue' : return { kind: 'ContinueStmt' };
        default      : return this.exprOrDeclStmt();
        }
    }

    private functionParamSpec(): AST.FunctionParam[] {
        const paramSpec: AST.FunctionParam[] = [];
        this.expect('(');
        while (!this.predicate(')')) {
            let flags = AST.FunctionParamFlags.None;

            while (['in', 'out', 'inout'].includes(this.headKind()!)) {
                const token = this.nextToken()!;
                if (token.kind === 'in')
                    flags |= AST.FunctionParamFlags.In;
                else if (token.kind === 'out')
                    flags |= AST.FunctionParamFlags.Out;
                else if (token.kind === 'inout')
                    flags |= AST.FunctionParamFlags.InOut;
            }

            const type = this.expectID();
            const name = this.expectID();
            paramSpec.push({ type, name, flags });
            if (!this.match(','))
                break;
        }
        this.expect(')');
        return paramSpec;
    }

    private functionDecl(): AST.FunctionDecl {
        const returnTypeStr = this.expectID();
        const returnParam: AST.FunctionParam = { name: '$ret', type: returnTypeStr, flags: AST.FunctionParamFlags.None };
        const name = this.expectID();
        const params = this.functionParamSpec();
        const body = this.blockStmt() as AST.BlockStmt;
        return { kind: 'FunctionDecl', name, returnParam, params, body };
    }

    private globalDecl(): AST.GlobalDecl {
        this.match('static');
        const isConst = this.match('const');

        const type = this.expectID();
        const name = this.expectID();

        let init: AST.Expr | null = null;
        if (this.match('='))
            init = this.expr();

        this.expect(';');
        return { kind: 'GlobalDecl', type, name, init, isConst };
    }

    public module(): AST.Module {
        const declarations: AST.Decl[] = [];

        while (this.headKind() !== null) {
            switch (this.headKind()) {
            case 'static':
            case 'const':
                declarations.push(this.globalDecl());
                break;
            default:
                declarations.push(this.functionDecl());
                break;
            }
        }

        return { declarations };
    }
}

export function parse(s: string): AST.Module {
    const lexer = new Lexer(s);
    const parser = new Parser(lexer);
    return parser.module();
}
