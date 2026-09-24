# Cadastro do catálogo de teste

Cada produto tem nome (`title`), coleção (`collection`), tipo de peça (`category`),
categoria de uso (`activityCategory`) e cores (`colors`). O nome do conjunto não
cria automaticamente cadastros das peças avulsas. As combinações de duas cores
representam um único conjunto, não duas variantes vendidas separadamente.

Os filtros de categoria aceitam tipo de peça ou categoria de uso. Coleção e cor
são filtros adicionais, combináveis e preservados na paginação. Suas opções vêm
do catálogo. A busca também considera esses campos. Os links da página de produto
levam diretamente à coleção ou à categoria correspondente.

`featured: true` destaca produtos na home, com limite de oito cards. Novos produtos
também aparecem no catálogo paginado. IDs existentes foram mantidos para preservar
favoritos, sacolas e histórico de navegação.

## Novos conjuntos

Preços, tecidos e tamanhos abaixo são fictícios para o ambiente de teste, conforme
autorizado. Todos usam tamanhos PP, P, M, G e GG e começam sem avaliações.

| Produto                  | Preço de teste | Cor               | Coleção  | Categoria de uso       | Tecido de teste |
| ------------------------ | -------------- | ----------------- | -------- | ---------------------- | --------------- |
| STUW Everyday Short Set  | R$ 890         | Beige / Black     | Everyday | Activewear / Lifestyle | ShieldAir       |
| STUW Move Zip Set        | R$ 690         | Black             | Move     | Activewear / Training  | SculptHold      |
| STUW Studio Half-Zip Set | R$ 590         | Off-White / Mocha | Studio   | Activewear / Studio    | VelvetNulu      |
| STUW Active Run Set      | R$ 450         | Black             | Run      | Activewear / Running   | SilkAir         |
| STUW Sculpt Set Mocha    | R$ 650         | Mocha             | Sculpt   | Activewear / Training  | SculptHold      |

O Everyday usa o par `bomber-taupe`, cuja fotografia mostra a jaqueta bege com
biker preto; a jaqueta avulsa permanece no catálogo. O Sculpt Set Mocha com legging
é um produto distinto do Mocha Sculpt Set com calça flare já cadastrado.

Na integração com Olist/Supabase, mapear esses campos no repositório de produtos
e substituir os dados comerciais de teste pelos dados reais do catálogo.
