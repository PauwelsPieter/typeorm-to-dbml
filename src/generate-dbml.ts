#!/usr/bin/env node

import { Project, ClassDeclaration, Decorator, PropertyDeclaration } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Parse CLI arguments
 */
function parseArgs(): { sourceGlob: string; outputPath: string } {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Error: sourceGlob is required');
    console.error('Usage: typeorm-to-dbml <sourceGlob> [outputPath]');
    console.error('Example: typeorm-to-dbml "src/entities/**/*.ts" "./schema.dbml"');
    process.exit(1);
  }

  const sourceGlob = args[0];
  const outputPath = args[1] || './schema.dbml';

  return { sourceGlob, outputPath };
}

/**
 * Map TypeScript types to DBML types
 */
function mapTypeToDbml(tsType: string): string {
  const typeMap: Record<string, string> = {
    'string': 'varchar',
    'number': 'integer',
    'boolean': 'boolean',
    'Date': 'timestamp',
    'any': 'text',
  };

  return typeMap[tsType] || 'varchar';
}

/**
 * Get the entity name from @Entity decorator
 */
function getEntityName(classDecl: ClassDeclaration): string {
  const entityDecorator = classDecl.getDecorator('Entity');
  if (!entityDecorator) {
    return classDecl.getName() || 'UnknownEntity';
  }

  const args = entityDecorator.getArguments();
  if (args.length > 0) {
    const arg = args[0];
    const text = arg.getText().replace(/['"]/g, '');
    if (text && text !== '{}') {
      return text;
    }
  }

  return classDecl.getName() || 'UnknownEntity';
}

/**
 * Check if a property has a specific decorator
 */
function hasDecorator(property: PropertyDeclaration, decoratorName: string): boolean {
  return property.getDecorator(decoratorName) !== undefined;
}

/**
 * Get decorator by name
 */
function getDecorator(property: PropertyDeclaration, decoratorName: string): Decorator | undefined {
  return property.getDecorator(decoratorName);
}

/**
 * Check if a column is nullable from @Column decorator options
 */
function isNullable(property: PropertyDeclaration): boolean {
  const columnDecorator = getDecorator(property, 'Column');
  if (!columnDecorator) {
    return false;
  }

  const args = columnDecorator.getArguments();
  if (args.length > 0) {
    const optionsText = args[0].getText();
    return optionsText.includes('nullable:') && optionsText.includes('true');
  }

  return false;
}

/**
 * Get the target entity from @ManyToOne decorator
 */
function getManyToOneTarget(property: PropertyDeclaration): string | null {
  const manyToOneDecorator = getDecorator(property, 'ManyToOne');
  if (!manyToOneDecorator) {
    return null;
  }

  const args = manyToOneDecorator.getArguments();
  if (args.length > 0) {
    const targetArg = args[0].getText();
    // Handle () => Entity format
    const match = targetArg.match(/=>\s*(\w+)/);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Process a single entity class and convert to DBML
 */
function processEntity(
  classDecl: ClassDeclaration,
  classToEntityMap: Map<string, string>
): { table: string; refs: string[] } {
  const entityName = getEntityName(classDecl);
  const properties = classDecl.getProperties();

  let tableDefinition = `Table ${entityName} {\n`;
  const refs: string[] = [];

  for (const property of properties) {
    const propertyName = property.getName();
    const propertyType = property.getType().getText();

    // Handle @PrimaryGeneratedColumn
    if (hasDecorator(property, 'PrimaryGeneratedColumn')) {
      tableDefinition += `  ${propertyName} integer [pk, increment]\n`;
      continue;
    }

    // Handle @Column
    if (hasDecorator(property, 'Column')) {
      const dbmlType = mapTypeToDbml(propertyType);
      const nullable = isNullable(property);
      const nullableStr = nullable ? ' [null]' : '';
      tableDefinition += `  ${propertyName} ${dbmlType}${nullableStr}\n`;
      continue;
    }

    // Handle @ManyToOne
    if (hasDecorator(property, 'ManyToOne')) {
      const targetClassName = getManyToOneTarget(property);
      if (targetClassName) {
        // Add the foreign key column
        const fkColumnName = property.getName() + 'Id';
        tableDefinition += `  ${fkColumnName} integer\n`;
        // Resolve the target entity name using the map
        const targetEntityName = classToEntityMap.get(targetClassName) || targetClassName;
        // Create the relationship reference
        refs.push(`Ref: ${entityName}.${fkColumnName} > ${targetEntityName}.id`);
      }
      continue;
    }
  }

  tableDefinition += `}\n`;

  return { table: tableDefinition, refs };
}

/**
 * Main function to generate DBML from TypeORM entities
 */
function generateDbml(sourceGlob: string, outputPath: string): void {
  // Initialize ts-morph project
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
  });

  // Add source files based on glob pattern
  project.addSourceFilesAtPaths(sourceGlob);

  const sourceFiles = project.getSourceFiles();
  if (sourceFiles.length === 0) {
    console.error(`No files found matching pattern: ${sourceGlob}`);
    process.exit(1);
  }

  // First pass: Build a map of class names to entity names
  const classToEntityMap = new Map<string, string>();
  for (const sourceFile of sourceFiles) {
    const classes = sourceFile.getClasses();
    for (const classDecl of classes) {
      if (classDecl.getDecorator('Entity')) {
        const className = classDecl.getName();
        const entityName = getEntityName(classDecl);
        if (className) {
          classToEntityMap.set(className, entityName);
        }
      }
    }
  }

  let dbmlContent = '';
  const allRefs: string[] = [];

  // Second pass: Process each source file
  for (const sourceFile of sourceFiles) {
    const classes = sourceFile.getClasses();

    for (const classDecl of classes) {
      // Check if the class has @Entity decorator
      if (classDecl.getDecorator('Entity')) {
        const { table, refs } = processEntity(classDecl, classToEntityMap);
        dbmlContent += table + '\n';
        allRefs.push(...refs);
      }
    }
  }

  // Add relationships at the end
  if (allRefs.length > 0) {
    dbmlContent += '\n// Relationships\n';
    for (const ref of allRefs) {
      dbmlContent += ref + '\n';
    }
  }

  // Write output file
  const resolvedPath = path.resolve(outputPath);
  fs.writeFileSync(resolvedPath, dbmlContent.trim(), 'utf8');

  console.log(`DBML schema generated successfully: ${resolvedPath}`);
  console.log(`Processed ${sourceFiles.length} file(s)`);
}

// Main execution
const { sourceGlob, outputPath } = parseArgs();
generateDbml(sourceGlob, outputPath);
