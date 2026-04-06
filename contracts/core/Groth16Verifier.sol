// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity >=0.7.0 <0.9.0;

contract Groth16Verifier {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 20491192805390485299153009773594534940189261866228447918068658471970481763042;
    uint256 constant alphay  = 9383485363053290200918347156157836566562967994039712273449902621266178545958;
    uint256 constant betax1  = 4252822878758300859123897981450591353533073413197771768651442665752259397132;
    uint256 constant betax2  = 6375614351688725206403948262868962793625744043794305715222011528459656738731;
    uint256 constant betay1  = 21847035105528745403288232691147584728191162732299865338377159692350059136679;
    uint256 constant betay2  = 10505242626370262277552901082094356697409835680220590971873171140371331206856;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 8270300422521695473895559941070848264869082997345324468651703914784426684591;
    uint256 constant deltax2 = 9444327433899127769511072374276650554113835441024687648967683827360130233093;
    uint256 constant deltay1 = 680369779592579070309692332884118248257404814095608575756543382541163546044;
    uint256 constant deltay2 = 15355236587837893815519230849838500468783909251559832033716542916287717575007;

    
    uint256 constant IC0x = 19983461393745515184783189818715448562827799049093105472966810671709427893192;
    uint256 constant IC0y = 16373783250236775659234465932766224900734036925502844756848596606756095747729;
    
    uint256 constant IC1x = 21011627834347499945001737193394175224616766933505310016406685766839336993646;
    uint256 constant IC1y = 18326197997998131412418934636589850327754174995590875891437486251851541587934;
    
    uint256 constant IC2x = 599364667518731876297100115840850716336563944909694977094256892749956120070;
    uint256 constant IC2y = 157254622026319303101057718075299470645764237064995355873381679721099022351;
    
    uint256 constant IC3x = 9536013186150258058166424972176606763998969478584838513373002327996754988994;
    uint256 constant IC3y = 21077962281820009090340116682733555445856897773580177067957023253328613257579;
    
    uint256 constant IC4x = 21241687854840739829360547600683291583048487523842943266672269003092646975154;
    uint256 constant IC4y = 3870721796020137048744498475370651926187190442460279705681525890193451236043;
    
    uint256 constant IC5x = 19882917709951953770334924318609248860429713771405553664339007802916641880102;
    uint256 constant IC5y = 4150521921878909043812371793592187867773571146543670399325351493489671693134;
    
    uint256 constant IC6x = 20782033374768922550120022777351465375879675302835109211658417383655305199396;
    uint256 constant IC6y = 20152729795912284363911961789493881670968305136680061950686568964722192207383;
    
    uint256 constant IC7x = 1525264048982349139216205261102638227153125280383511977762530400585231634915;
    uint256 constant IC7y = 9939041398024580840249465312148693545393401221839174881860244767679011742332;
    
    uint256 constant IC8x = 2358946724213462376105745881109779337069845673832435878479333756272270452872;
    uint256 constant IC8y = 7047303665696599239722660202485139717680971870593569533463304272962222165399;
    
    uint256 constant IC9x = 13263093290038231709754301371937673403557690783096944300400165439001358760805;
    uint256 constant IC9y = 18851817727266582646967210561049093193195357577167043221932832170245388084061;
    
    uint256 constant IC10x = 19083812145262219098357171819520009513852428919626319163426085918215117994607;
    uint256 constant IC10y = 16238458274388909105517248239108876223209706631413314697952083290833094687843;
    
    uint256 constant IC11x = 21404797539818866069747102314138332424734457524803242896510126380570151851632;
    uint256 constant IC11y = 8238721013590705695823985126718605360988000023974624602466267782242674278208;
    
    uint256 constant IC12x = 5079415669553381743658707297648732482860997372137480412806063728999621024934;
    uint256 constant IC12y = 120295992466679724349899277254047314024871594284051674609974621923871377127;
    
    uint256 constant IC13x = 17631045703158741676903208081703316152211179067080208308331006892057279683499;
    uint256 constant IC13y = 18052960753080281576669086096852460166306568274064449557915755591964484969858;
    
    uint256 constant IC14x = 16488932509232455957280197330609672193034067210204332555648915650577384885170;
    uint256 constant IC14y = 16680375694485768839193882438823933009827142255118609283475305078900760520981;
    
    uint256 constant IC15x = 2393195911789665981411653050239655939015049061290694940193892788119880384507;
    uint256 constant IC15y = 4124966071172645025519307331462987771643895174190597400781452216848411948612;
    
    uint256 constant IC16x = 881930525930462209816382581618607298250132450352667137241620006751797135262;
    uint256 constant IC16y = 1132688970479622000979698115090270058478926456492958580330843858722185626784;
    
    uint256 constant IC17x = 2033704833973234746537630165765359184508163135723277433375839670492361650102;
    uint256 constant IC17y = 10819602893634527785280664233047688835216417960351044495068819304545694253694;
    
    uint256 constant IC18x = 16783984024221846052579613253773738150740968214319585365146090146617243582188;
    uint256 constant IC18y = 7184891374338528544010635908915438692832742534605121708684395466655896154179;
    
    uint256 constant IC19x = 11878643145765821593755885168762596208502710450767451956927660510090127336850;
    uint256 constant IC19y = 14197196492160510902652580487188982268764046893299861795132271441742160560595;
    
    uint256 constant IC20x = 15265141196840352207519283848280032221284922738545893491870075757634558394609;
    uint256 constant IC20y = 16809273588903409098996368020189282326678184110044692456376192876892719736660;
    
    uint256 constant IC21x = 9191155703981338773266777898211745920716734186171201735984873691530686327852;
    uint256 constant IC21y = 9809025641763394255697471397293862851677471331637273690848214142899060211801;
    
    uint256 constant IC22x = 462402391404000707403170161292442583767639464394572185842984828289747342495;
    uint256 constant IC22y = 13985370154741202398796735978681785843918061232150014512412299838466792208956;
    
    uint256 constant IC23x = 424095113190863936183467852605657771340431336395920266216555986415440342760;
    uint256 constant IC23y = 13539036381380554076852286070942691988283490066731310513578677861011199452215;
    
    uint256 constant IC24x = 10206700938709805973847568032058806935302734965182755236848321217126531287296;
    uint256 constant IC24y = 632199132633936964860503638193979895523178948648049416725491072840019308824;
    
    uint256 constant IC25x = 1755574658147168122389924472270048857300898792655467922146324747866095187190;
    uint256 constant IC25y = 5991517862961460451375641249393424790541243768848298530748649643762699723755;
    
    uint256 constant IC26x = 2411680701816490449634923076117898648181929446843298893159151977031774682895;
    uint256 constant IC26y = 20457882027681025255171552981379602131636547965168884966831909605593366616149;
    
    uint256 constant IC27x = 12901373141907863569743847609062845479260353351147857853975629055311133771659;
    uint256 constant IC27y = 12380787683006045301306125896482266116204890376834575807459650095555287007554;
    
    uint256 constant IC28x = 21001993885955424838515063318085322416748750153162943549411515416172785458584;
    uint256 constant IC28y = 7596282716770072798800966138769900154638611965392475394042973549383531981184;
    
    uint256 constant IC29x = 20896037279877688021649766920341262676050904562214079687353002272154892479558;
    uint256 constant IC29y = 18433985417318149408848456412988765139644881483416592490006949366328095772275;
    
    uint256 constant IC30x = 17194169481954339392364517135971163423504868798440711300615590720605262202293;
    uint256 constant IC30y = 9430616593284549017308262369943831404601632264639657294446911201408610142253;
    
    uint256 constant IC31x = 12196294661151304256460628177029967599619830479423080509477648038901646022328;
    uint256 constant IC31y = 8244302084749188398659148837741337094797229958992299251337243344970397559423;
    
    uint256 constant IC32x = 7230979577775622191627236078290912079885515634353672123689430746565680698592;
    uint256 constant IC32y = 7109309940624150388080211319201263239570103762226217869333054800832314103537;
    
    uint256 constant IC33x = 1850356799292154075751286986932452117452058971447656839768741626697403489841;
    uint256 constant IC33y = 3959058220679813448409273563822880225871835177705569133870377141424159044184;
    
    uint256 constant IC34x = 12332950508653876325528204590606312446528118228892874708700059377628477784882;
    uint256 constant IC34y = 19673982226140012372804383003072820669537606755295458164488005816889032918287;
    
    uint256 constant IC35x = 19318094190426953603277013554953640828170705428728804879301084867490550642835;
    uint256 constant IC35y = 19903814758646284140881765660087423024994203380531348817221506692149553537959;
    
    uint256 constant IC36x = 6477220881019437645901632732096010949162744393693930426497233878697281938461;
    uint256 constant IC36y = 20325654641144738161972539383477696665537734303987411159306365234832211243627;
    
    uint256 constant IC37x = 3569382802050376436147141678390889271817056644925124591036431826682424650778;
    uint256 constant IC37y = 1143215075830158374590568955371211830244740045430686870141736073006273224892;
    
    uint256 constant IC38x = 6715288525926543089285244051250569690325609904431151143147768665322324901214;
    uint256 constant IC38y = 14997044438557480864563514147765655415894456174779112119432875048051915241052;
    
    uint256 constant IC39x = 7531731057812573598435299452947652217748081342587707243584626078803796081698;
    uint256 constant IC39y = 15597836925277014329334582432463307508874346947696126904568389983791935884478;
    
    uint256 constant IC40x = 21165898468196432622104477540215267109476331399140008459186069560028354997939;
    uint256 constant IC40y = 14841033602609786339289421616545398967297874004886402779980821073891174565068;
    
    uint256 constant IC41x = 13081720848192291463071655499317963996712774295006057551961975435195637890238;
    uint256 constant IC41y = 18076024805808075660330854301568479807709447156572572198073564009935239842543;
    
    uint256 constant IC42x = 9703346442441786977063271540971291582492271719442262423181893439676523612280;
    uint256 constant IC42y = 11515685140814284503000518565381831519573966945481137696581281172943645328466;
    
    uint256 constant IC43x = 7805026351384514041075219075918382110559860546246516986410621283169699610328;
    uint256 constant IC43y = 17376156180556864199458611672314244075972656004883660025658055684853704429220;
    
    uint256 constant IC44x = 18154790634193268869495992241519954950386611371325605768446780233821044706450;
    uint256 constant IC44y = 6165957044826745435953849441469939926524460820966344984149409420882487814027;
    
    uint256 constant IC45x = 13907039590115764963649604173392095631417846390182366630000541290333957110712;
    uint256 constant IC45y = 21112564589244677329288686207443751666827339589178401858998088540836794659621;
    
    uint256 constant IC46x = 11200412783490173805484430744377148166915305355484291587554816568497499965332;
    uint256 constant IC46y = 8233252015956513079072638942363836442801869720601162969382625069526273405321;
    
    uint256 constant IC47x = 3416720265655796945430117405168102088433182002476438948316963705470171226825;
    uint256 constant IC47y = 11215106107341100594032782087497316814386336172519210390134383189827076572584;
    
    uint256 constant IC48x = 18762255765453045511465148758487378241269766357475490156131919114091553208765;
    uint256 constant IC48y = 5991199163479909416512336460006383097736230506984507808998229208989783019358;
    
    uint256 constant IC49x = 10603157868519609721183909525876532062254811483646971046382159996181715978677;
    uint256 constant IC49y = 3946757361210000200131651840351432992714656601440550005282004207932661764334;
    
    uint256 constant IC50x = 3255876765631234176584993326037803412394751232683867468043075658798714753334;
    uint256 constant IC50y = 10404835624025715391656535287985294223031622416346629143106762924445400666992;
    
    uint256 constant IC51x = 17528239529052010513349404231949594739498218603182464239141139027407990350533;
    uint256 constant IC51y = 21678137562178412675990999543838983865928473955421485508293199400501763651249;
    
    uint256 constant IC52x = 21250223894376783719497407611732501623778717499166084412258014194256141499978;
    uint256 constant IC52y = 5395944845921236655615594933558912109322376153685990941675779281238545689256;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[52] calldata _pubSignals) public view returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, r)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }
            
            // G1 function to multiply a G1 value(x,y) to value in an address
            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn, 32), y)
                mstore(add(mIn, 64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }

                mstore(add(mIn, 64), mload(pR))
                mstore(add(mIn, 96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
                let _pPairing := add(pMem, pPairing)
                let _pVk := add(pMem, pVk)

                mstore(_pVk, IC0x)
                mstore(add(_pVk, 32), IC0y)

                // Compute the linear combination vk_x
                
                g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))
                
                g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))
                
                g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))
                
                g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))
                
                g1_mulAccC(_pVk, IC5x, IC5y, calldataload(add(pubSignals, 128)))
                
                g1_mulAccC(_pVk, IC6x, IC6y, calldataload(add(pubSignals, 160)))
                
                g1_mulAccC(_pVk, IC7x, IC7y, calldataload(add(pubSignals, 192)))
                
                g1_mulAccC(_pVk, IC8x, IC8y, calldataload(add(pubSignals, 224)))
                
                g1_mulAccC(_pVk, IC9x, IC9y, calldataload(add(pubSignals, 256)))
                
                g1_mulAccC(_pVk, IC10x, IC10y, calldataload(add(pubSignals, 288)))
                
                g1_mulAccC(_pVk, IC11x, IC11y, calldataload(add(pubSignals, 320)))
                
                g1_mulAccC(_pVk, IC12x, IC12y, calldataload(add(pubSignals, 352)))
                
                g1_mulAccC(_pVk, IC13x, IC13y, calldataload(add(pubSignals, 384)))
                
                g1_mulAccC(_pVk, IC14x, IC14y, calldataload(add(pubSignals, 416)))
                
                g1_mulAccC(_pVk, IC15x, IC15y, calldataload(add(pubSignals, 448)))
                
                g1_mulAccC(_pVk, IC16x, IC16y, calldataload(add(pubSignals, 480)))
                
                g1_mulAccC(_pVk, IC17x, IC17y, calldataload(add(pubSignals, 512)))
                
                g1_mulAccC(_pVk, IC18x, IC18y, calldataload(add(pubSignals, 544)))
                
                g1_mulAccC(_pVk, IC19x, IC19y, calldataload(add(pubSignals, 576)))
                
                g1_mulAccC(_pVk, IC20x, IC20y, calldataload(add(pubSignals, 608)))
                
                g1_mulAccC(_pVk, IC21x, IC21y, calldataload(add(pubSignals, 640)))
                
                g1_mulAccC(_pVk, IC22x, IC22y, calldataload(add(pubSignals, 672)))
                
                g1_mulAccC(_pVk, IC23x, IC23y, calldataload(add(pubSignals, 704)))
                
                g1_mulAccC(_pVk, IC24x, IC24y, calldataload(add(pubSignals, 736)))
                
                g1_mulAccC(_pVk, IC25x, IC25y, calldataload(add(pubSignals, 768)))
                
                g1_mulAccC(_pVk, IC26x, IC26y, calldataload(add(pubSignals, 800)))
                
                g1_mulAccC(_pVk, IC27x, IC27y, calldataload(add(pubSignals, 832)))
                
                g1_mulAccC(_pVk, IC28x, IC28y, calldataload(add(pubSignals, 864)))
                
                g1_mulAccC(_pVk, IC29x, IC29y, calldataload(add(pubSignals, 896)))
                
                g1_mulAccC(_pVk, IC30x, IC30y, calldataload(add(pubSignals, 928)))
                
                g1_mulAccC(_pVk, IC31x, IC31y, calldataload(add(pubSignals, 960)))
                
                g1_mulAccC(_pVk, IC32x, IC32y, calldataload(add(pubSignals, 992)))
                
                g1_mulAccC(_pVk, IC33x, IC33y, calldataload(add(pubSignals, 1024)))
                
                g1_mulAccC(_pVk, IC34x, IC34y, calldataload(add(pubSignals, 1056)))
                
                g1_mulAccC(_pVk, IC35x, IC35y, calldataload(add(pubSignals, 1088)))
                
                g1_mulAccC(_pVk, IC36x, IC36y, calldataload(add(pubSignals, 1120)))
                
                g1_mulAccC(_pVk, IC37x, IC37y, calldataload(add(pubSignals, 1152)))
                
                g1_mulAccC(_pVk, IC38x, IC38y, calldataload(add(pubSignals, 1184)))
                
                g1_mulAccC(_pVk, IC39x, IC39y, calldataload(add(pubSignals, 1216)))
                
                g1_mulAccC(_pVk, IC40x, IC40y, calldataload(add(pubSignals, 1248)))
                
                g1_mulAccC(_pVk, IC41x, IC41y, calldataload(add(pubSignals, 1280)))
                
                g1_mulAccC(_pVk, IC42x, IC42y, calldataload(add(pubSignals, 1312)))
                
                g1_mulAccC(_pVk, IC43x, IC43y, calldataload(add(pubSignals, 1344)))
                
                g1_mulAccC(_pVk, IC44x, IC44y, calldataload(add(pubSignals, 1376)))
                
                g1_mulAccC(_pVk, IC45x, IC45y, calldataload(add(pubSignals, 1408)))
                
                g1_mulAccC(_pVk, IC46x, IC46y, calldataload(add(pubSignals, 1440)))
                
                g1_mulAccC(_pVk, IC47x, IC47y, calldataload(add(pubSignals, 1472)))
                
                g1_mulAccC(_pVk, IC48x, IC48y, calldataload(add(pubSignals, 1504)))
                
                g1_mulAccC(_pVk, IC49x, IC49y, calldataload(add(pubSignals, 1536)))
                
                g1_mulAccC(_pVk, IC50x, IC50y, calldataload(add(pubSignals, 1568)))
                
                g1_mulAccC(_pVk, IC51x, IC51y, calldataload(add(pubSignals, 1600)))
                
                g1_mulAccC(_pVk, IC52x, IC52y, calldataload(add(pubSignals, 1632)))
                

                // -A
                mstore(_pPairing, calldataload(pA))
                mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

                // B
                mstore(add(_pPairing, 64), calldataload(pB))
                mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
                mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
                mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

                // alpha1
                mstore(add(_pPairing, 192), alphax)
                mstore(add(_pPairing, 224), alphay)

                // beta2
                mstore(add(_pPairing, 256), betax1)
                mstore(add(_pPairing, 288), betax2)
                mstore(add(_pPairing, 320), betay1)
                mstore(add(_pPairing, 352), betay2)

                // vk_x
                mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
                mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))


                // gamma2
                mstore(add(_pPairing, 448), gammax1)
                mstore(add(_pPairing, 480), gammax2)
                mstore(add(_pPairing, 512), gammay1)
                mstore(add(_pPairing, 544), gammay2)

                // C
                mstore(add(_pPairing, 576), calldataload(pC))
                mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

                // delta2
                mstore(add(_pPairing, 640), deltax1)
                mstore(add(_pPairing, 672), deltax2)
                mstore(add(_pPairing, 704), deltay1)
                mstore(add(_pPairing, 736), deltay2)


                let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

                isOk := and(success, mload(_pPairing))
            }

            let pMem := mload(0x40)
            mstore(0x40, add(pMem, pLastMem))

            // Validate that all evaluations ∈ F
            
            checkField(calldataload(add(_pubSignals, 0)))
            
            checkField(calldataload(add(_pubSignals, 32)))
            
            checkField(calldataload(add(_pubSignals, 64)))
            
            checkField(calldataload(add(_pubSignals, 96)))
            
            checkField(calldataload(add(_pubSignals, 128)))
            
            checkField(calldataload(add(_pubSignals, 160)))
            
            checkField(calldataload(add(_pubSignals, 192)))
            
            checkField(calldataload(add(_pubSignals, 224)))
            
            checkField(calldataload(add(_pubSignals, 256)))
            
            checkField(calldataload(add(_pubSignals, 288)))
            
            checkField(calldataload(add(_pubSignals, 320)))
            
            checkField(calldataload(add(_pubSignals, 352)))
            
            checkField(calldataload(add(_pubSignals, 384)))
            
            checkField(calldataload(add(_pubSignals, 416)))
            
            checkField(calldataload(add(_pubSignals, 448)))
            
            checkField(calldataload(add(_pubSignals, 480)))
            
            checkField(calldataload(add(_pubSignals, 512)))
            
            checkField(calldataload(add(_pubSignals, 544)))
            
            checkField(calldataload(add(_pubSignals, 576)))
            
            checkField(calldataload(add(_pubSignals, 608)))
            
            checkField(calldataload(add(_pubSignals, 640)))
            
            checkField(calldataload(add(_pubSignals, 672)))
            
            checkField(calldataload(add(_pubSignals, 704)))
            
            checkField(calldataload(add(_pubSignals, 736)))
            
            checkField(calldataload(add(_pubSignals, 768)))
            
            checkField(calldataload(add(_pubSignals, 800)))
            
            checkField(calldataload(add(_pubSignals, 832)))
            
            checkField(calldataload(add(_pubSignals, 864)))
            
            checkField(calldataload(add(_pubSignals, 896)))
            
            checkField(calldataload(add(_pubSignals, 928)))
            
            checkField(calldataload(add(_pubSignals, 960)))
            
            checkField(calldataload(add(_pubSignals, 992)))
            
            checkField(calldataload(add(_pubSignals, 1024)))
            
            checkField(calldataload(add(_pubSignals, 1056)))
            
            checkField(calldataload(add(_pubSignals, 1088)))
            
            checkField(calldataload(add(_pubSignals, 1120)))
            
            checkField(calldataload(add(_pubSignals, 1152)))
            
            checkField(calldataload(add(_pubSignals, 1184)))
            
            checkField(calldataload(add(_pubSignals, 1216)))
            
            checkField(calldataload(add(_pubSignals, 1248)))
            
            checkField(calldataload(add(_pubSignals, 1280)))
            
            checkField(calldataload(add(_pubSignals, 1312)))
            
            checkField(calldataload(add(_pubSignals, 1344)))
            
            checkField(calldataload(add(_pubSignals, 1376)))
            
            checkField(calldataload(add(_pubSignals, 1408)))
            
            checkField(calldataload(add(_pubSignals, 1440)))
            
            checkField(calldataload(add(_pubSignals, 1472)))
            
            checkField(calldataload(add(_pubSignals, 1504)))
            
            checkField(calldataload(add(_pubSignals, 1536)))
            
            checkField(calldataload(add(_pubSignals, 1568)))
            
            checkField(calldataload(add(_pubSignals, 1600)))
            
            checkField(calldataload(add(_pubSignals, 1632)))
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
