import { useEffect, useState, type ChangeEvent, type FormEvent, type MouseEvent } from 'react'
import { AssetModels, createManagementClient, LanguageModels } from '@kontent-ai/management-sdk';
import './App.css'

interface Map {
  [key: string]: any;
}

function App() {
  const [environmentId, setEnvironmentId] = useState<string>('');
  const [apiKey, setAPIKey] = useState<string>('');
  const [languages, setLanguages] = useState<Array<LanguageModels.LanguageModel>>();
  const [languageMap, setLanguageMap] = useState({});
  const [assets, setAssets] = useState<Array<AssetModels.Asset>>();
  const [filteredAssets, setFilteredAssets] = useState<Array<AssetModels.Asset>>();
  const [pageCount, setPageCount] = useState(0);

  async function handleSubmit(event: FormEvent, type: string) {
    event.preventDefault();

    const environmentIdInput = document.getElementById('environment-id') as HTMLInputElement;
    const keyInput = document.getElementById('api-key') as HTMLInputElement;

    setEnvironmentId(environmentIdInput.value);
    setAPIKey(keyInput.value);

    const client = createManagementClient({
      environmentId: environmentIdInput.value,
      apiKey: keyInput.value
    });

    client
        .listAssets()
        .toAllPromise()
        .then((assetsResponse) => {
          if (assetsResponse.data.items.length > 0) {
            client.listLanguages()
              .toPromise()
              .then((langResponse) => {
                if (langResponse.data.items.length > 0) {
                  const activeLanguages = langResponse.data.items.filter((lang) => lang.isActive === true);
                  const map: Map = {};
                  
                  activeLanguages.map((lang) => {
                    map[lang.id] = lang.name;
                  })

                  let pages = 0;

                  console.log('assetsResponse.data.items.length: ', assetsResponse.data.items.length);

                  for (let i = 0; i < assetsResponse.data.items.length; i += 10) {
                    pages++;
                  }

                  setPageCount(pages);
                  setLanguageMap({...map});
                  setLanguages(activeLanguages);
                  setAssets(assetsResponse.data.items);
                  setFilteredAssets(assetsResponse.data.items);
                }
              })
          }
        })
  }

  function handleLanguageSelection(e: ChangeEvent<HTMLSelectElement>) {
    const language = e.target.value;


  }

  function handleVisibility(langCodename: string) {
    const langColumn = document.getElementById(langCodename);

    if (langColumn) {
      if (langColumn.style.visibility === 'visible') langColumn.style.visibility = 'collapse';
      else langColumn.style.visibility = 'visible';
    }
  }

  useEffect(() => {

  }, [assets]);

  return (
    <div>
      {/* <div>
        <h1 className='text-xl text-left mb-12 font-bold'>Find empty asset descriptions</h1>
      </div> */}
      <form onSubmit={(e) => handleSubmit(e, 'api-key')} className='basis-full flex flex-wrap place-content-start mb-6'>
        <div className='basis-full relative flex flex-wrap mb-6'>
          <label id='environment-id-label' htmlFor='environment-id' className='basis-full text-left mb-3 font-bold focus:border-color-(--orange)'>
            Environment ID
          <span className='tooltip-icon' title="The environment ID of the environment where your assets are located. This can be found under 'Environment settings', or as the value in the URL as shown: app.kontent.ai/<environment-id>.">ⓘ</span>
          </label>
          <input type='text' id='environment-id' name='environment-id' required />
          {/* <p id='environment-id-error' className='hidden absolute bg-(--red) text-white px-2 py-[0.25rem] rounded-lg top-0 left-[160px]'>
            {environmentIdErrorText}
          </p> */}
        </div>
        <div className='basis-full relative flex flex-wrap'>
          <label id='api-key-label' htmlFor='api-key' className='basis-full text-left mb-3 font-bold focus:border-color-(--orange)'>
            Management API Key
            <span className='tooltip-icon' title=''>ⓘ</span>
          </label>
          <input type='text' id='api-key' name='api-key' className='mb-6' required />
          {/* <p id='api-key-error' className='hidden absolute bg-(--red) text-white px-2 py-[0.25rem] rounded-lg top-0 left-[230px]'>
            {apiKeyErrorText}
          </p> */}
        </div>
        <div className='justify-self-end h-[60px] basis-full text-right'>
          <button type='submit' className='btn continue-btn place-self-end'>Get assets</button>
        </div>
      </form>
      <div className='mb-6'>
        <label htmlFor='lang-selector'>
          Languages
        </label>
        {
          languages?.map((lang) => 
            <div>
              <input id={`${lang.codename}-checkbox`} className='mr-2' type='checkbox' value={lang.name} />
              <label htmlFor={`${lang.codename}-checkbox`}>{lang.name}</label>
            </div>
          )
        }
        {/* <select id='lang-selector' className='ml-1.5' onChange={(e) => handleLanguageSelection(e)}>
          <option value='none'>All</option>
          {
            languages?.map((lang) => 
              <option value={lang.name}>{lang.name}</option>
            )
          }
        </select> */}
      </div>
      <table>
        <colgroup>
          <col id='file-name'></col>
          <col id='title'></col>
          {
            languages?.map((lang) => 
              <col id={lang.codename}></col>
            )
          }
        </colgroup>
        <thead>
          <tr>
            <th colSpan={2}>Asset metadata</th>
            <th colSpan={languages?.length}>Descriptions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>File name</th>
            <th className='title-cell'>Title</th>
            {
              languages?.map((lang) => 
                <th>
                  {lang.name}
                  {/* <button onClick={(e) => handleVisibility(lang.codename)}>👁️</button> */}
                </th>
              )
            }
          </tr>
          {
            filteredAssets ?
              filteredAssets.length > 0 ?
                filteredAssets.map((asset) => 
                      <tr>
                        <td>
                          {asset.fileName}
                          <a href={`https:\/\/app.kontent.ai/${environmentId}/content-inventory/assets/asset/${asset.id}`} target='_blank' className='ml-4'>
                          🔗
                          </a>
                        </td>
                        {
                          asset.title ? <td className='title-cell bg-green-100'>{asset.title}</td> : <td className='title-cell bg-red-100'>None</td>
                        }
                        {
                          languages?.map((lang) => (
                            asset.descriptions.map((description) => (
                              lang.id === description.language.id ?
                                description.description ?
                                  <td className='cell bg-green-100'>{description.description}</td>
                                :
                                  <td className='cell bg-red-100'>None</td>
                              :
                                null
                              )
                            )
                          ))
                        }
                      </tr>
                )
              :
              null
            :
            null
          }
          {/* {
            assets ?
              assets.length > 0 ?
                assets.map((asset) => 
                      <tr>
                        <td>
                          {asset.fileName}
                          <a href={`https:\/\/app.kontent.ai/${environmentId}/content-inventory/assets/asset/${asset.id}`} target='_blank' className='ml-4'>
                          🔗
                          </a>
                        </td>
                        <td className='title-cell'>
                          {
                            asset.title ? asset.title : 'No title'
                          }
                        </td>
                        {
                          languages?.map((lang) => (
                            asset.descriptions.map((description) => (
                              lang.id === description.language.id ?
                                description.description ?
                                  <td>{description.description}</td>
                                :
                                  <td>None</td>
                              :
                                null
                              )
                            )
                          ))
                        }
                      </tr>
                )
              :
              null
            :
            null
          } */}
        </tbody>
      </table>
      {
        pageCount !== 0 ?
          Array.from({ length: pageCount }).map((_, index) => (
            <button className='mr-2'>{index + 1}</button>
          ))
        :
        null
      }
    </div>
  )
}

export default App