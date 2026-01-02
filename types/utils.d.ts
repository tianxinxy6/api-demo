/**
 * 工具类型定义
 */

 type RecordNamePaths<T extends object> = {
   [K in NestedKeyOf<T>]: PropType<T, K>
 }
