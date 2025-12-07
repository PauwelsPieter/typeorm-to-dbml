# TypeORM to DBML Converter

A script to parse TypeScript entity files decorated with TypeORM metadata and automatically generate a Database Markup Language (DBML) schema. This allows you to easily visualize your database structure using tools like [dbdiagram.io](https://dbdiagram.io/).

## ✨ Features

The converter script uses `ts-morph` to statically analyze your code and currently supports the following TypeORM features:

- **Entity Detection:** Finds classes decorated with `@Entity()`.
- **Table Naming:** Supports both class names and explicit table names (`@Entity('users')`).
- **Primary Keys:** Detects `@PrimaryGeneratedColumn` and maps them to `[pk, increment]`.
- **Standard Columns:** Detects `@Column`, `@CreateDateColumn`, etc.
- **Type Mapping:** Maps common TypeScript types (`string`, `number`, `Date`) to suitable DBML/SQL types (`varchar`, `int`, `timestamp`).
- **Constraints:** Detects `{ nullable: true }` options and maps them to `[null]`.
- **Basic Relations:** Detects `@ManyToOne` and generates a Foreign Key reference (`Ref: > Target.id`) based on standard TypeORM conventions.

## 🛠️ Prerequisites

To run this script, you need:

- Node.js (v14+)
- TypeScript
- The `ts-node` package (for easy execution)
- The `ts-morph` package (for AST parsing)

## ⚙️ Usage

```bash
ts-node generate-dbml.ts "<entity-file-glob>" "<output-path>"

# Example:
ts-node generate-dbml.ts "./src/entities/**/*.ts" "./schema.dbml"
```
