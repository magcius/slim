
export interface TernaryExpr {
    kind: "TernaryExpr";
    op: string;
    expr: Expr;
    lhs: Expr;
    rhs: Expr;
}

export interface BinaryExpr {
    kind: "BinaryExpr";
    op: string;
    lhs: Expr;
    rhs: Expr;
}

export interface UnaryExpr {
    kind: "UnaryExpr";
    op: string;
    expr: Expr;
}

export interface LoadExpr {
    kind: "LoadExpr";
    id: string;
}

export interface StoreExpr {
    kind: "StoreExpr";
    op: string; // =, +=, -=, etc.
    lhs: Expr;
    rhs: Expr;
}

export interface FloatLiteralExpr {
    kind: "FloatLiteralExpr";
    val: number;
}

export interface CallExpr {
    kind: "CallExpr";
    lhs: Expr;
    args: Expr[];
}

export interface MemberExpr {
    kind: "MemberExpr";
    lhs: Expr;
    id: string;
}

export interface IndexExpr {
    kind: "IndexExpr";
    lhs: Expr;
    index: Expr;
}

export type Expr = TernaryExpr | BinaryExpr | UnaryExpr | LoadExpr | StoreExpr | FloatLiteralExpr | CallExpr | MemberExpr | IndexExpr;

export interface IfStmt {
    kind: "IfStmt";
    cond: Expr;
    body: Stmt;
    elseBody: Stmt | null;
}

export interface ForStmt {
    kind: "ForStmt";
    init: Stmt;
    cond: Expr;
    iter: Expr;
    body: Stmt;
}

export interface WhileStmt {
    kind: "WhileStmt";
    cond: Expr;
    body: Stmt;
}

export interface DoWhileStmt {
    kind: "DoWhileStmt";
    cond: Expr;
    body: Stmt;
}

export interface BlockStmt {
    kind: "BlockStmt";
    body: Stmt[];
}

export interface ExprStmt {
    kind: "ExprStmt";
    body: Expr;
}

interface _DeclBase {
    type: string;
    name: string;
    init: Expr | null;
    isConst: boolean;
}

export interface DeclStmt extends _DeclBase {
    kind: "DeclStmt";
}

export interface ReturnStmt {
    kind: "ReturnStmt";
    rhs: Expr | null;
}

export interface ContinueStmt {
    kind: "ContinueStmt";
}

export interface BreakStmt {
    kind: "BreakStmt";
}

export type Stmt = IfStmt | ForStmt | WhileStmt | DoWhileStmt | BlockStmt | ExprStmt | DeclStmt | ReturnStmt | ContinueStmt | BreakStmt;

export enum FunctionParamFlags {
    None    = 0,
    In      = 1 << 0,
    Out     = 1 << 1,
    InOut   = In | Out,
}

export interface FunctionParam {
    name: string;
    type: string;
    flags: FunctionParamFlags;
}

export interface FunctionDecl {
    kind: "FunctionDecl";
    name: string;
    params: FunctionParam[];
    returnParam: FunctionParam;
    body: BlockStmt;
}

export interface GlobalDecl extends _DeclBase {
    kind: "GlobalDecl";
    type: string;
    name: string;
    init: Expr | null;
}

export type Decl = FunctionDecl | GlobalDecl;

export interface Module {
    declarations: Decl[];
}
