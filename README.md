# typeorm-to-dbml

Convert a TypeScript project using TypeORM decorators to a DBML diagram.

## Installation

```bash
npm install
npm build
```

## Usage

```bash
npm start <sourceGlob> [outputPath]
```

### Parameters

- `sourceGlob` (required): Glob pattern to match TypeORM entity files (e.g., `"src/entities/**/*.ts"`)
- `outputPath` (optional): Path to output DBML file (default: `./schema.dbml`)

### Example

```bash
npm start "examples/entities/**/*.ts" "./schema.dbml"
```

## Features

The tool supports the following TypeORM decorators:

- **`@Entity`**: Converts to DBML table. Uses class name or decorator argument as table name.
- **`@PrimaryGeneratedColumn`**: Converts to `[pk, increment]` in DBML. When using the `'uuid'` strategy, it will generate a `varchar [pk]` column.
- **`@Column`**: Maps TypeScript types to DBML types (e.g., `string` → `varchar`). Supports `{ nullable: true }` and `{ default: ... }` options. It also allows specifying the column type directly, like `@Column({ type: 'jsonb' })`.
- **`@ManyToOne`**: Extracts the target entity to create a foreign key relationship.
- **`@JoinColumn`**: Used with `@ManyToOne` to specify the foreign key column name via the `name` option.

### Type Mapping (When type is not explicitly specified)

| TypeScript Type | DBML Type   |
| --------------- | ----------- |
| `string`        | `varchar`   |
| `number`        | `integer`   |
| `boolean`       | `boolean`   |
| `Date`          | `timestamp` |
| `any`           | `text`      |

## Example Output

Given TypeORM entities like:

```typescript
@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  bio: string;

  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @Column({ type: "jsonb" })
  customFields: object;
}

@Entity("posts")
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @ManyToOne(() => User)
  author: User;
}
```

The tool generates:

```dbml
Table user {
  id integer [pk, increment]
  name varchar
  bio varchar [null]
  is_active boolean [default: true]
  custom_fields jsonb
}

Table posts {
  id integer [pk, increment]
  title varchar
}

// relationships
Ref: posts.author_id > user.id
```

## License

See LICENSE file.
