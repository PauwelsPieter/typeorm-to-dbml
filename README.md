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
- **`@Column`**: Maps TypeScript types to DBML types (e.g., `string` → `varchar`). Supports `{ nullable: true }` option.
- **`@ManyToOne`**: Extracts the target entity to create a foreign key relationship.
- **`@JoinColumn`**: Used with `@ManyToOne` to specify the foreign key column name via the `name` option.

### Type Mapping

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
Table User {
  id integer [pk, increment]
  name varchar
  bio varchar [null]
}

Table posts {
  id integer [pk, increment]
  title varchar
  authorId integer
}

// Relationships
Ref: posts.authorId > User.id
```

## License

See LICENSE file.
