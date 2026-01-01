import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

const Converter = require('openapi-to-postmanv2');

async function generatePostmanCollection() {
  console.log('🚀 从 Swagger 文档生成 Postman 集合...');

  const swaggerUrl = process.env.SWAGGER_URL || 'http://localhost:3000/docs/json';

  try {
    console.log(`📡 正在获取 Swagger 文档: ${swaggerUrl}`);
    
    // 从运行中的服务器获取 Swagger JSON
    const response = await axios.get(swaggerUrl);
    const swaggerDoc = response.data;

    console.log('✅ Swagger 文档获取成功');
    console.log('🔄 转换为 Postman 集合...');

    // 转换为 Postman 集合
    Converter.convert(
      { type: 'json', data: swaggerDoc },
      {},
      (err: any, conversionResult: any) => {
        if (err) {
          console.error('❌ 转换失败:', err);
          process.exit(1);
        }

        if (!conversionResult.result) {
          console.error('❌ 转换失败:', conversionResult.reason);
          process.exit(1);
        }

        // 保存到文件
        const outputPath = path.join(process.cwd(), 'postman.json');
        const collection = conversionResult.output[0].data;

        fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2));

        console.log('✅ Postman 集合生成成功!');
        console.log(`📁 文件位置: ${outputPath}`);
        console.log(
          `📊 包含 ${collection.item?.length || 0} 个接口分组`,
        );

        process.exit(0);
      },
    );
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ 无法连接到服务器，请确保应用正在运行:');
      console.error('   运行命令: npm run start:dev');
      console.error(`   确保服务运行在: ${swaggerUrl}`);
    } else {
      console.error('❌ 生成过程出错:', error.message);
    }
    process.exit(1);
  }
}

generatePostmanCollection();
