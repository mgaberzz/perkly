alter table public.campuses add column if not exists name_ar text, add column if not exists city_ar text;
update public.campuses set name_ar='جامعة عين شمس', city_ar='القاهرة' where name='Ain Shams University' and name_ar is null;
update public.campuses set name_ar='جامعة الإسكندرية', city_ar='الإسكندرية' where name='Alexandria University' and name_ar is null;
update public.campuses set name_ar='الجامعة الأمريكية بالقاهرة', city_ar='القاهرة الجديدة' where name='American University in Cairo' and name_ar is null;
update public.campuses set name_ar='الأكاديمية العربية للعلوم والتكنولوجيا', city_ar='الإسكندرية' where name='Arab Academy for Science & Technology' and name_ar is null;
update public.campuses set name_ar='جامعة القاهرة', city_ar='الجيزة' where name='Cairo University' and name_ar is null;
update public.campuses set name_ar='الجامعة الألمانية بالقاهرة', city_ar='القاهرة الجديدة' where name='German University in Cairo' and name_ar is null;
update public.campuses set name_ar='جامعة مصر الدولية', city_ar='القاهرة' where name='Misr International University' and name_ar is null;
update public.campuses set name_ar='جامعة أكتوبر للعلوم الحديثة والآداب', city_ar='6 أكتوبر' where name='MSA University' and name_ar is null;
update public.campuses set name_ar='جامعة النيل', city_ar='الشيخ زايد' where name='Nile University' and name_ar is null;
update public.campuses set name_ar='الجامعة البريطانية في مصر', city_ar='الشروق' where name='The British University in Egypt' and name_ar is null;
insert into public.campuses (name, name_ar, short_name, city, city_ar, type, lat, lng)
select v.* from (values
 ('Al-Azhar University','جامعة الأزهر','Azhar','Cairo','القاهرة','university',30.058,31.311),
 ('Helwan University','جامعة حلوان','HU','Helwan','حلوان','university',29.8667,31.317),
 ('Assiut University','جامعة أسيوط','AUN','Assiut','أسيوط','university',27.1856,31.168),
 ('Tanta University','جامعة طنطا','TU','Tanta','طنطا','university',30.7935,30.9969),
 ('Mansoura University','جامعة المنصورة','MU','Mansoura','المنصورة','university',31.0425,31.3543),
 ('Zagazig University','جامعة الزقازيق','ZU','Zagazig','الزقازيق','university',30.5878,31.4826),
 ('Minia University','جامعة المنيا','MinU','Minya','المنيا','university',28.103,30.7385),
 ('Menoufia University','جامعة المنوفية','MNF','Shebin El Kom','شبين الكوم','university',30.5605,31.009),
 ('Suez Canal University','جامعة قناة السويس','SCU','Ismailia','الإسماعيلية','university',30.623,32.269),
 ('South Valley University','جامعة جنوب الوادي','SVU','Qena','قنا','university',26.195,32.743),
 ('Beni-Suef University','جامعة بني سويف','BSU','Beni Suef','بني سويف','university',29.07,31.099),
 ('Fayoum University','جامعة الفيوم','FU','Fayoum','الفيوم','university',29.322,30.838),
 ('Benha University','جامعة بنها','BU','Benha','بنها','university',30.466,31.183),
 ('Kafrelsheikh University','جامعة كفر الشيخ','KFS','Kafr El Sheikh','كفر الشيخ','university',31.106,30.942),
 ('Sohag University','جامعة سوهاج','SU','Sohag','سوهاج','university',26.559,31.695),
 ('Port Said University','جامعة بورسعيد','PSU','Port Said','بورسعيد','university',31.256,32.29),
 ('Damanhour University','جامعة دمنهور','DU','Damanhour','دمنهور','university',31.039,30.472),
 ('Aswan University','جامعة أسوان','ASWU','Aswan','أسوان','university',24.089,32.899),
 ('Damietta University','جامعة دمياط','DamU','New Damietta','دمياط الجديدة','university',31.424,31.667),
 ('University of Sadat City','جامعة مدينة السادات','USC','Sadat City','مدينة السادات','university',30.397,30.513),
 ('Suez University','جامعة السويس','SuezU','Suez','السويس','university',29.97,32.523),
 ('Arish University','جامعة العريش','AU','Arish','العريش','university',31.13,33.8),
 ('New Valley University','جامعة الوادي الجديد','NVU','Kharga','الخارجة','university',25.45,30.55),
 ('Matrouh University','جامعة مطروح','MatU','Marsa Matrouh','مرسى مطروح','university',31.35,27.23),
 ('Luxor University','جامعة الأقصر','LXU','Luxor','الأقصر','university',25.69,32.64),
 ('Egypt-Japan University of Science and Technology','الجامعة المصرية اليابانية للعلوم والتكنولوجيا','EJUST','Borg El Arab','برج العرب','university',30.865,29.58),
 ('Zewail City of Science and Technology','مدينة زويل للعلوم والتكنولوجيا','Zewail','6th of October','6 أكتوبر','university',30.011,30.968),
 ('Galala University','جامعة الجلالة','GU','Galala City','مدينة الجلالة','university',29.42,32.38),
 ('King Salman International University','جامعة الملك سلمان الدولية','KSIU','El Tor','الطور','university',28.24,33.62),
 ('Alamein International University','جامعة العلمين الدولية','AIU','New Alamein','العلمين الجديدة','university',30.835,28.95),
 ('New Mansoura University','جامعة المنصورة الجديدة','NMU','New Mansoura','المنصورة الجديدة','university',31.45,31.47),
 ('Egypt University of Informatics','جامعة مصر للمعلوماتية','EUI','New Administrative Capital','العاصمة الإدارية الجديدة','university',30.005,31.712),
 ('Future University in Egypt','جامعة المستقبل','FUE','New Cairo','القاهرة الجديدة','university',30.027,31.488),
 ('October 6 University','جامعة 6 أكتوبر','O6U','6th of October','6 أكتوبر','university',29.975,30.946),
 ('Misr University for Science and Technology','جامعة مصر للعلوم والتكنولوجيا','MUST','6th of October','6 أكتوبر','university',29.9925,30.966),
 ('Pharos University in Alexandria','جامعة فاروس بالإسكندرية','PUA','Alexandria','الإسكندرية','university',31.216,29.955),
 ('Ahram Canadian University','جامعة الأهرام الكندية','ACU','6th of October','6 أكتوبر','university',29.95,30.91),
 ('Sinai University','جامعة سيناء','SinaiU','Arish','العريش','university',31.096,33.754),
 ('Delta University for Science and Technology','جامعة الدلتا للعلوم والتكنولوجيا','DUST','Gamasa','جمصة','university',31.438,31.53),
 ('Horus University','جامعة حورس','HUE','New Damietta','دمياط الجديدة','university',31.432,31.687),
 ('Badr University in Cairo','جامعة بدر بالقاهرة','BUC','Badr City','مدينة بدر','university',30.122,31.713),
 ('Heliopolis University','جامعة هليوبوليس','HeU','Cairo','القاهرة','university',30.17,31.415),
 ('Egyptian Russian University','الجامعة المصرية الروسية','ERU','Badr City','مدينة بدر','university',30.145,31.708),
 ('Nahda University','جامعة النهضة','NUB','Beni Suef','بني سويف','university',29.05,31.16),
 ('Deraya University','جامعة دراية','DerU','Minya','المنيا','university',28.04,30.82),
 ('Sphinx University','جامعة سفنكس','SphU','New Assiut','أسيوط الجديدة','university',27.23,31.37),
 ('Al-Ryada University for Science and Technology','جامعة الريادة للعلوم والتكنولوجيا','RST','Sadat City','مدينة السادات','university',30.4,30.53),
 ('Egyptian Chinese University','الجامعة المصرية الصينية','ECU','Cairo','القاهرة','university',30.128,31.37),
 ('Modern University for Technology and Information','الجامعة الحديثة للتكنولوجيا والمعلومات','MTI','Cairo','القاهرة','university',30.003,31.316),
 ('Badya University','جامعة بادية','Badya','6th of October','6 أكتوبر','university',29.92,30.88),
 ('New Giza University','جامعة نيو جيزة','NGU','Giza','الجيزة','university',30.017,31.023),
 ('Egyptian E-Learning University','الجامعة المصرية للتعلم الإلكتروني','EELU','Giza','الجيزة','university',30.038,31.21),
 ('German International University','الجامعة الألمانية الدولية','GIU','New Administrative Capital','العاصمة الإدارية الجديدة','university',30.008,31.705),
 ('Universities of Canada in Egypt','الجامعات الكندية في مصر','UCE','New Administrative Capital','العاصمة الإدارية الجديدة','university',30.01,31.71),
 ('Coventry University (The Knowledge Hub)','جامعة كوفنتري (المعرفة)','TKH','New Administrative Capital','العاصمة الإدارية الجديدة','university',30.007,31.708),
 ('University of Hertfordshire (GAF)','جامعة هيرتفوردشاير (GAF)','UH','New Administrative Capital','العاصمة الإدارية الجديدة','university',30.006,31.702),
 ('Université Française d''Égypte','الجامعة الفرنسية في مصر','UFE','El Shorouk','الشروق','university',30.154,31.629),
 ('Arab Academy for Science & Technology (Cairo)','الأكاديمية العربية للعلوم والتكنولوجيا (القاهرة)','AASTC','Cairo','القاهرة','university',30.1,31.377),
 ('Other university or institute','جامعة أو معهد آخر','Other','Egypt','مصر','university',null,null)
) as v(name, name_ar, short_name, city, city_ar, type, lat, lng)
where not exists (select 1 from public.campuses c where lower(c.name) = lower(v.name));
