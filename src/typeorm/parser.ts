import {
  ClassDeclaration,
  Decorator,
  PropertyDeclaration,
} from 'ts-morph';
import { mapTypeToDbml } from '../dbml/mapper';
import { getEntityName } from './entity';
import { toSnakeCase } from '../helpers/to-snake-case';

function getPropertyTypeName(property: PropertyDeclaration): string {
  const typeNode = property.getTypeNode();
  if (typeNode) {
    return typeNode.getText();
  }
  return property.getType().getText();
}

function hasDecorator(
  property: PropertyDeclaration,
  decoratorName: string
): boolean {
  return property.getDecorator(decoratorName) !== undefined;
}

function getDecorator(
  property: PropertyDeclaration,
  decoratorName: string
): Decorator | undefined {
  return property.getDecorator(decoratorName);
}

function isNullable(property: PropertyDeclaration): boolean {
  const columnDecorator = getDecorator(property, 'Column');
  if (!columnDecorator) {
    return false;
  }

  const args = columnDecorator.getArguments();
  if (args.length > 0) {
    const optionsText = args[0].getText();
    const nullableMatch = optionsText.match(/nullable\s*:\s*true/);
    return nullableMatch !== null;
  }

  return false;
}

function getJoinColumnName(property: PropertyDeclaration): string | null {
  const joinColumnDecorator = getDecorator(property, 'JoinColumn');
  if (!joinColumnDecorator) {
    return null;
  }

  const args = joinColumnDecorator.getArguments();
  if (args.length > 0) {
    const optionsText = args[0].getText();
    const nameMatch = optionsText.match(/name\s*:\s*['"]([^'"]+)['"]/);
    if (nameMatch && nameMatch[1]) {
      return nameMatch[1];
    }
  }

  return null;
}

function getManyToOneTarget(property: PropertyDeclaration): string | null {
  const manyToOneDecorator = getDecorator(property, 'ManyToOne');
  if (!manyToOneDecorator) {
    return null;
  }

  const args = manyToOneDecorator.getArguments();
  if (args.length > 0) {
    const targetArg = args[0].getText();
    // Matches: () => Entity, () => entities.Entity, () => module.Entity
    const match = targetArg.match(/=>\s*([\w.]+)/);
    if (match) {
      const fullName = match[1];
      const parts = fullName.split('.');
      return parts[parts.length - 1];
    }
  }

  return null;
}

export function processEntity(
  classDecl: ClassDeclaration,
  classToEntityMap: Map<string, string>
): { table: string; refs: string[] } {
  const entityName = getEntityName(classDecl);
  const properties = classDecl.getProperties();

  let tableDefinition = `Table ${entityName} {\n`;
  const refs: string[] = [];

  for (const property of properties) {
    const propertyName = toSnakeCase(property.getName());

    if (hasDecorator(property, 'PrimaryGeneratedColumn')) {
      const decorator = property.getDecorator('PrimaryGeneratedColumn')!;
      const args = decorator.getArguments();

      if (args.length > 0 && args[0].getText() === "'uuid'") {
        tableDefinition += `  ${propertyName} varchar [pk]\n`;
      } else {
        tableDefinition += `  ${propertyName} integer [pk, increment]\n`;
      }
      continue;
    }

    if (hasDecorator(property, 'Column')) {
      const propertyType = getPropertyTypeName(property);
      const dbmlType = mapTypeToDbml(propertyType);
      const nullable = isNullable(property);
      const nullableStr = nullable ? ' [null]' : '';
      tableDefinition += `  ${propertyName} ${dbmlType}${nullableStr}\n`;
      continue;
    }

    if (hasDecorator(property, 'ManyToOne')) {
      const targetClassName = getManyToOneTarget(property);
      if (targetClassName) {
        const fkColumnName =
          getJoinColumnName(property) || `${property.getName()}_id`;
        const targetEntityName =
          classToEntityMap.get(targetClassName) || targetClassName;
        refs.push(
          `Ref: ${entityName}.${fkColumnName} > ${targetEntityName}.uuid`
        );
      }
      continue;
    }
  }

  tableDefinition += `}\n`;

  return { table: tableDefinition, refs };
}
